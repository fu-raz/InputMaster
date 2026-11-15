//! Windows media/volume capture + OS suppress.
//! Ported from the proven `keyboard-capture-test` harness:
//! - WH_KEYBOARD_LL returns 1 without CallNextHookEx to eat keys
//! - RegisterHotKey backup on a message-only window (same capture thread)
//! - No RIDEV_NOLEGACY (that stuck after disable)
//! - Hook callback only emits MidiEvents (no UI / SendMessage)

use super::catalog::{
    note_event, volume_wheel_event, KeyboardControlId, MASK_ALL, MASK_MEDIA_NEXT,
    MASK_MEDIA_PLAY_PAUSE, MASK_MEDIA_PREV, MASK_MEDIA_STOP, MASK_VOLUME_MUTE, MASK_VOLUME_WHEEL,
};
use crate::model::MidiEvent;
use crate::run_logger;
use std::sync::atomic::{AtomicBool, AtomicIsize, AtomicU32, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread::{self, JoinHandle};
use windows::core::w;
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::System::Threading::GetCurrentThreadId;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    RegisterHotKey, UnregisterHotKey, HOT_KEY_MODIFIERS, VK_MEDIA_NEXT_TRACK, VK_MEDIA_PLAY_PAUSE,
    VK_MEDIA_PREV_TRACK, VK_MEDIA_STOP, VK_VOLUME_DOWN, VK_VOLUME_MUTE, VK_VOLUME_UP,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, GetMessageW,
    PostMessageW, PostQuitMessage, PostThreadMessageW, RegisterClassExW, SendMessageW,
    SetWindowsHookExW, TranslateMessage, UnhookWindowsHookEx, CS_GLOBALCLASS, HHOOK, HMENU,
    HWND_MESSAGE, KBDLLHOOKSTRUCT, MSG, WINDOW_EX_STYLE, WINDOW_STYLE, WM_APP, WM_CREATE,
    WM_DESTROY, WM_HOTKEY, WM_KEYDOWN, WM_KEYUP, WM_QUIT, WM_SYSKEYDOWN, WM_SYSKEYUP, WNDCLASSEXW,
    WH_KEYBOARD_LL,
};

const LLKHF_INJECTED: u32 = 0x10;
const LLKHF_LOWER_IL_INJECTED: u32 = 0x02;
const HC_ACTION: i32 = 0;
const WM_REFRESH_HOTKEYS: u32 = WM_APP + 2;
/// Capture-thread: unregister hotkeys, SendInput media VK, re-register.
/// Binding media actions must not be swallowed by our own RegisterHotKey suppress.
const WM_SYNTHETIC_MEDIA: u32 = WM_APP + 3;

type EventSink = Arc<dyn Fn(MidiEvent) + Send + Sync + 'static>;

static HOOK_ACTIVE: AtomicBool = AtomicBool::new(false);
static HOOK_HANDLE: AtomicIsize = AtomicIsize::new(0);
static HOOK_THREAD_ID: AtomicU32 = AtomicU32::new(0);
static HOTKEY_HWND: AtomicIsize = AtomicIsize::new(0);
static ENABLED_MASK: AtomicU32 = AtomicU32::new(MASK_ALL);
/// >0 while InputMaster is synthesizing a media key for a binding action.
static SYNTHETIC_MEDIA: AtomicU32 = AtomicU32::new(0);
static EVENT_SINK: OnceLock<Mutex<Option<EventSink>>> = OnceLock::new();

fn is_synthetic_media() -> bool {
    SYNTHETIC_MEDIA.load(Ordering::SeqCst) > 0
}

fn inject_media_key_raw(vk: u16) {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP,
        VIRTUAL_KEY,
    };

    let key_down = INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: VIRTUAL_KEY(vk),
                wScan: 0,
                dwFlags: KEYBD_EVENT_FLAGS(0),
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };
    let key_up = INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: VIRTUAL_KEY(vk),
                wScan: 0,
                dwFlags: KEYEVENTF_KEYUP,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };
    unsafe {
        SendInput(&[key_down, key_up], std::mem::size_of::<INPUT>() as i32);
    }
}

/// Send a media VK so OS/apps receive it even while keyboard capture is suppressing
/// the same physical keys (RegisterHotKey would otherwise eat our own SendInput).
pub fn send_media_key_bypassing_capture(vk: u16) {
    if !HOOK_ACTIVE.load(Ordering::SeqCst) {
        inject_media_key_raw(vk);
        return;
    }
    let hwnd = HWND(HOTKEY_HWND.load(Ordering::SeqCst) as *mut _);
    if hwnd.0.is_null() {
        // LL hook alone: injected events already CallNextHookEx.
        inject_media_key_raw(vk);
        return;
    }
    // Run on the capture thread so UnregisterHotKey/RegisterHotKey stay on the owner thread.
    unsafe {
        let _ = SendMessageW(
            hwnd,
            WM_SYNTHETIC_MEDIA,
            Some(WPARAM(vk as usize)),
            Some(LPARAM(0)),
        );
    }
}

pub(super) fn set_global_enabled_mask(mask: u32) {
    ENABLED_MASK.store(mask, Ordering::SeqCst);
}

fn vk_capture_mask(vk: u16) -> Option<u32> {
    if vk == VK_VOLUME_MUTE.0 {
        Some(MASK_VOLUME_MUTE)
    } else if vk == VK_VOLUME_UP.0 || vk == VK_VOLUME_DOWN.0 {
        Some(MASK_VOLUME_WHEEL)
    } else if vk == VK_MEDIA_PLAY_PAUSE.0 {
        Some(MASK_MEDIA_PLAY_PAUSE)
    } else if vk == VK_MEDIA_NEXT_TRACK.0 {
        Some(MASK_MEDIA_NEXT)
    } else if vk == VK_MEDIA_PREV_TRACK.0 {
        Some(MASK_MEDIA_PREV)
    } else if vk == VK_MEDIA_STOP.0 {
        Some(MASK_MEDIA_STOP)
    } else {
        None
    }
}

fn is_vk_enabled(vk: u16) -> bool {
    match vk_capture_mask(vk) {
        Some(bit) => (ENABLED_MASK.load(Ordering::SeqCst) & bit) != 0,
        None => false,
    }
}

fn event_sink_slot() -> &'static Mutex<Option<EventSink>> {
    EVENT_SINK.get_or_init(|| Mutex::new(None))
}

fn emit(event: MidiEvent) {
    if let Ok(guard) = event_sink_slot().lock() {
        if let Some(sink) = guard.as_ref() {
            sink(event);
        }
    }
}

fn catalogued_vks() -> [(u16, u8); 7] {
    // Hotkey id is index+1. Volume up/down map to wheel deltas (same as LL hook).
    [
        (VK_VOLUME_MUTE.0, 1),
        (VK_VOLUME_DOWN.0, 2),
        (VK_VOLUME_UP.0, 3),
        (VK_MEDIA_NEXT_TRACK.0, 4),
        (VK_MEDIA_PREV_TRACK.0, 5),
        (VK_MEDIA_STOP.0, 6),
        (VK_MEDIA_PLAY_PAUSE.0, 7),
    ]
}

fn handle_catalogued_key(vk: u16, pressed: bool) {
    if vk == VK_VOLUME_MUTE.0 {
        emit(note_event(KeyboardControlId::VolumeMute, pressed));
    } else if vk == VK_VOLUME_UP.0 {
        if pressed {
            if let Some(event) = volume_wheel_event(1) {
                emit(event);
            }
        }
    } else if vk == VK_VOLUME_DOWN.0 {
        if pressed {
            if let Some(event) = volume_wheel_event(-1) {
                emit(event);
            }
        }
    } else if vk == VK_MEDIA_PLAY_PAUSE.0 {
        emit(note_event(KeyboardControlId::MediaPlayPause, pressed));
    } else if vk == VK_MEDIA_NEXT_TRACK.0 {
        emit(note_event(KeyboardControlId::MediaNext, pressed));
    } else if vk == VK_MEDIA_PREV_TRACK.0 {
        emit(note_event(KeyboardControlId::MediaPrev, pressed));
    } else if vk == VK_MEDIA_STOP.0 {
        emit(note_event(KeyboardControlId::MediaStop, pressed));
    }
}

fn is_catalogued_vk(vk: u16) -> bool {
    catalogued_vks().iter().any(|(candidate, _)| *candidate == vk)
}

unsafe extern "system" fn low_level_keyboard_proc(
    code: i32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if code != HC_ACTION {
        return CallNextHookEx(None, code, wparam, lparam);
    }
    if !HOOK_ACTIVE.load(Ordering::SeqCst) {
        return CallNextHookEx(None, code, wparam, lparam);
    }

    let kb = &*(lparam.0 as *const KBDLLHOOKSTRUCT);
    let injected = (kb.flags.0 & (LLKHF_INJECTED | LLKHF_LOWER_IL_INJECTED)) != 0;
    // Pass through OS injection and our own binding media actions.
    if injected || is_synthetic_media() {
        return CallNextHookEx(None, code, wparam, lparam);
    }

    let vk = kb.vkCode as u16;
    if !is_catalogued_vk(vk) || !is_vk_enabled(vk) {
        return CallNextHookEx(None, code, wparam, lparam);
    }

    let message = wparam.0 as u32;
    let pressed = matches!(message, WM_KEYDOWN | WM_SYSKEYDOWN);
    let is_up = matches!(message, WM_KEYUP | WM_SYSKEYUP);
    if pressed || is_up {
        handle_catalogued_key(vk, pressed);
    } else {
        // Unknown edge for a catalogued VK — still eat while capture is active.
        handle_catalogued_key(vk, true);
    }

    // Eat: do not CallNextHookEx (proven harness behavior).
    LRESULT(1)
}

fn register_hotkeys(hwnd: HWND) {
    unregister_hotkeys(hwnd);
    for (vk, id) in catalogued_vks() {
        if !is_vk_enabled(vk) {
            continue;
        }
        match unsafe { RegisterHotKey(Some(hwnd), id as i32, HOT_KEY_MODIFIERS(0), vk as u32) } {
            Ok(()) => run_logger::info(
                "keyboard_input",
                "hotkey_registered",
                &format!("id={id} vk=0x{vk:02X}"),
            ),
            Err(err) => run_logger::warn(
                "keyboard_input",
                "hotkey_register_failed",
                &format!("id={id} vk=0x{vk:02X} error={err}"),
            ),
        }
    }
}

fn unregister_hotkeys(hwnd: HWND) {
    for i in 1..=32 {
        unsafe {
            let _ = UnregisterHotKey(Some(hwnd), i);
        }
    }
    let _ = hwnd;
}

fn handle_hotkey(id: i32) {
    // Do not treat our own synthesized media SendInput as a captured physical press.
    if is_synthetic_media() {
        return;
    }
    // Backup path if the OS delivers WM_HOTKEY instead of (or without) a suppressible LL event.
    // Emit a short press for buttons / one wheel step for volume.
    match id {
        1 => {
            if !is_vk_enabled(VK_VOLUME_MUTE.0) {
                return;
            }
            emit(note_event(KeyboardControlId::VolumeMute, true));
            emit(note_event(KeyboardControlId::VolumeMute, false));
        }
        2 => {
            if !is_vk_enabled(VK_VOLUME_DOWN.0) {
                return;
            }
            if let Some(event) = volume_wheel_event(-1) {
                emit(event);
            }
        }
        3 => {
            if !is_vk_enabled(VK_VOLUME_UP.0) {
                return;
            }
            if let Some(event) = volume_wheel_event(1) {
                emit(event);
            }
        }
        4 => {
            if !is_vk_enabled(VK_MEDIA_NEXT_TRACK.0) {
                return;
            }
            emit(note_event(KeyboardControlId::MediaNext, true));
            emit(note_event(KeyboardControlId::MediaNext, false));
        }
        5 => {
            if !is_vk_enabled(VK_MEDIA_PREV_TRACK.0) {
                return;
            }
            emit(note_event(KeyboardControlId::MediaPrev, true));
            emit(note_event(KeyboardControlId::MediaPrev, false));
        }
        6 => {
            if !is_vk_enabled(VK_MEDIA_STOP.0) {
                return;
            }
            emit(note_event(KeyboardControlId::MediaStop, true));
            emit(note_event(KeyboardControlId::MediaStop, false));
        }
        7 => {
            if !is_vk_enabled(VK_MEDIA_PLAY_PAUSE.0) {
                return;
            }
            emit(note_event(KeyboardControlId::MediaPlayPause, true));
            emit(note_event(KeyboardControlId::MediaPlayPause, false));
        }
        _ => {}
    }
}

unsafe extern "system" fn hotkey_wnd_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    match msg {
        WM_CREATE => LRESULT(0),
        WM_HOTKEY => {
            handle_hotkey(wparam.0 as i32);
            LRESULT(0)
        }
        WM_REFRESH_HOTKEYS => {
            register_hotkeys(hwnd);
            run_logger::info(
                "keyboard_input",
                "hotkeys_refreshed",
                &format!("mask=0x{:02X}", ENABLED_MASK.load(Ordering::SeqCst)),
            );
            LRESULT(0)
        }
        WM_SYNTHETIC_MEDIA => {
            let vk = wparam.0 as u16;
            SYNTHETIC_MEDIA.fetch_add(1, Ordering::SeqCst);
            unregister_hotkeys(hwnd);
            inject_media_key_raw(vk);
            register_hotkeys(hwnd);
            SYNTHETIC_MEDIA.fetch_sub(1, Ordering::SeqCst);
            run_logger::info(
                "keyboard_input",
                "synthetic_media_sent",
                &format!("vk=0x{vk:02X}"),
            );
            LRESULT(0)
        }
        WM_DESTROY => {
            unregister_hotkeys(hwnd);
            HOTKEY_HWND.store(0, Ordering::SeqCst);
            PostQuitMessage(0);
            LRESULT(0)
        }
        _ => DefWindowProcW(hwnd, msg, wparam, lparam),
    }
}

fn ensure_hotkey_window_class() -> windows::core::Result<()> {
    static REGISTERED: OnceLock<bool> = OnceLock::new();
    if REGISTERED.get().copied().unwrap_or(false) {
        return Ok(());
    }
    let instance = unsafe { GetModuleHandleW(None)? };
    let class_name = w!("InputMasterKeyboardHotkeyWindow");
    let wc = WNDCLASSEXW {
        cbSize: std::mem::size_of::<WNDCLASSEXW>() as u32,
        style: CS_GLOBALCLASS,
        lpfnWndProc: Some(hotkey_wnd_proc),
        cbClsExtra: 0,
        cbWndExtra: 0,
        hInstance: instance.into(),
        hIcon: Default::default(),
        hCursor: Default::default(),
        hbrBackground: Default::default(),
        lpszMenuName: windows::core::PCWSTR::null(),
        lpszClassName: class_name,
        hIconSm: Default::default(),
    };
    let atom = unsafe { RegisterClassExW(&wc) };
    if atom == 0 {
        // Class may already exist from a previous start in-process.
        run_logger::debug(
            "keyboard_input",
            "hotkey_class_register",
            "RegisterClassExW returned 0 (may already exist)",
        );
    }
    let _ = REGISTERED.set(true);
    Ok(())
}

fn create_hotkey_window() -> windows::core::Result<HWND> {
    ensure_hotkey_window_class()?;
    let instance = unsafe { GetModuleHandleW(None)? };
    let hwnd = unsafe {
        CreateWindowExW(
            WINDOW_EX_STYLE(0),
            w!("InputMasterKeyboardHotkeyWindow"),
            w!(""),
            WINDOW_STYLE(0),
            0,
            0,
            0,
            0,
            Some(HWND_MESSAGE),
            None::<HMENU>,
            Some(instance.into()),
            None,
        )?
    };
    HOTKEY_HWND.store(hwnd.0 as isize, Ordering::SeqCst);
    register_hotkeys(hwnd);
    Ok(hwnd)
}

fn install_hook() -> windows::core::Result<HHOOK> {
    let instance = unsafe { GetModuleHandleW(None)? };
    unsafe {
        SetWindowsHookExW(
            WH_KEYBOARD_LL,
            Some(low_level_keyboard_proc),
            Some(instance.into()),
            0,
        )
    }
}

pub struct KeyboardCapture {
    join: Option<JoinHandle<()>>,
}

impl KeyboardCapture {
    pub fn start(on_event: EventSink, enabled_mask: u32) -> Result<Self, String> {
        if HOOK_ACTIVE.swap(true, Ordering::SeqCst) {
            return Err("Keyboard capture already running".into());
        }

        ENABLED_MASK.store(enabled_mask, Ordering::SeqCst);

        {
            let mut sink = event_sink_slot()
                .lock()
                .map_err(|_| "Keyboard capture lock poisoned".to_string())?;
            *sink = Some(on_event);
        }

        let join = thread::Builder::new()
            .name("keyboard-input-hook".into())
            .spawn(|| {
                HOOK_THREAD_ID.store(unsafe { GetCurrentThreadId() }, Ordering::SeqCst);

                let hotkey_hwnd = match create_hotkey_window() {
                    Ok(hwnd) => Some(hwnd),
                    Err(err) => {
                        run_logger::warn(
                            "keyboard_input",
                            "hotkey_window_failed",
                            &format!("error={err} (continuing with LL hook only)"),
                        );
                        None
                    }
                };

                let hook = match install_hook() {
                    Ok(hook) => hook,
                    Err(err) => {
                        HOOK_ACTIVE.store(false, Ordering::SeqCst);
                        if let Some(hwnd) = hotkey_hwnd {
                            unregister_hotkeys(hwnd);
                            unsafe {
                                let _ = DestroyWindow(hwnd);
                            }
                        }
                        run_logger::error(
                            "keyboard_input",
                            "hook_install_failed",
                            &format!("error={err}"),
                        );
                        return;
                    }
                };
                HOOK_HANDLE.store(hook.0 as isize, Ordering::SeqCst);
                run_logger::info(
                    "keyboard_input",
                    "hook_started",
                    &format!(
                        "LL hook + RegisterHotKey suppress active mask=0x{:02X}",
                        ENABLED_MASK.load(Ordering::SeqCst)
                    ),
                );

                let mut msg = MSG::default();
                unsafe {
                    while GetMessageW(&mut msg, None, 0, 0).into() {
                        let _ = TranslateMessage(&msg);
                        DispatchMessageW(&msg);
                    }
                }

                HOOK_ACTIVE.store(false, Ordering::SeqCst);
                unsafe {
                    let _ = UnhookWindowsHookEx(hook);
                }
                HOOK_HANDLE.store(0, Ordering::SeqCst);
                if let Some(hwnd) = hotkey_hwnd {
                    unregister_hotkeys(hwnd);
                    unsafe {
                        let _ = DestroyWindow(hwnd);
                    }
                }
                HOTKEY_HWND.store(0, Ordering::SeqCst);
                HOOK_THREAD_ID.store(0, Ordering::SeqCst);
                run_logger::info("keyboard_input", "hook_stopped", "");
            })
            .map_err(|err| {
                HOOK_ACTIVE.store(false, Ordering::SeqCst);
                format!("Failed to start keyboard capture thread: {err}")
            })?;

        Ok(Self { join: Some(join) })
    }

    pub fn set_enabled_mask(&mut self, mask: u32) {
        ENABLED_MASK.store(mask, Ordering::SeqCst);
        let hwnd = HWND(HOTKEY_HWND.load(Ordering::SeqCst) as *mut _);
        if !hwnd.0.is_null() {
            unsafe {
                let _ = PostMessageW(Some(hwnd), WM_REFRESH_HOTKEYS, WPARAM(0), LPARAM(0));
            }
        }
    }

    pub fn stop(&mut self) {
        if !HOOK_ACTIVE.swap(false, Ordering::SeqCst) && self.join.is_none() {
            return;
        }
        // Stop eating immediately even before the thread unwinds.
        HOOK_ACTIVE.store(false, Ordering::SeqCst);

        let hwnd = HWND(HOTKEY_HWND.load(Ordering::SeqCst) as *mut _);
        if !hwnd.0.is_null() {
            unregister_hotkeys(hwnd);
        }

        let thread_id = HOOK_THREAD_ID.load(Ordering::SeqCst);
        if thread_id != 0 {
            unsafe {
                // Destroying the message window posts WM_DESTROY → PostQuitMessage.
                if !hwnd.0.is_null() {
                    let _ = DestroyWindow(hwnd);
                }
                let _ = PostThreadMessageW(thread_id, WM_QUIT, WPARAM(0), LPARAM(0));
            }
        }
        if let Some(join) = self.join.take() {
            let _ = join.join();
        }
        if let Ok(mut sink) = event_sink_slot().lock() {
            *sink = None;
        }
        HOTKEY_HWND.store(0, Ordering::SeqCst);
        HOOK_HANDLE.store(0, Ordering::SeqCst);
        HOOK_THREAD_ID.store(0, Ordering::SeqCst);
    }
}

impl Drop for KeyboardCapture {
    fn drop(&mut self) {
        self.stop();
    }
}
