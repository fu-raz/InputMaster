use super::catalog::{note_event, volume_wheel_event, KeyboardControlId};
use crate::model::MidiEvent;
use crate::run_logger;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread::{self, JoinHandle};
use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
use windows::Win32::System::Threading::GetCurrentThreadId;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    VK_MEDIA_NEXT_TRACK, VK_MEDIA_PLAY_PAUSE, VK_MEDIA_PREV_TRACK, VK_MEDIA_STOP, VK_VOLUME_DOWN,
    VK_VOLUME_MUTE, VK_VOLUME_UP,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetMessageW, PostThreadMessageW, SetWindowsHookExW,
    TranslateMessage, UnhookWindowsHookEx, HHOOK, KBDLLHOOKSTRUCT, KBDLLHOOKSTRUCT_FLAGS, MSG,
    WH_KEYBOARD_LL, WM_KEYDOWN, WM_KEYUP, WM_QUIT, WM_SYSKEYDOWN, WM_SYSKEYUP,
};

const LLKHF_INJECTED: KBDLLHOOKSTRUCT_FLAGS = KBDLLHOOKSTRUCT_FLAGS(0x10);
const LLKHF_LOWER_IL_INJECTED: KBDLLHOOKSTRUCT_FLAGS = KBDLLHOOKSTRUCT_FLAGS(0x02);

type EventSink = Arc<dyn Fn(MidiEvent) + Send + Sync + 'static>;

static HOOK_ACTIVE: AtomicBool = AtomicBool::new(false);
static HOOK_THREAD_ID: AtomicU32 = AtomicU32::new(0);
static EVENT_SINK: OnceLock<Mutex<Option<EventSink>>> = OnceLock::new();

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

fn is_catalogued_vk(vk: u16) -> bool {
    matches!(
        vk,
        v if v == VK_VOLUME_MUTE.0
            || v == VK_VOLUME_DOWN.0
            || v == VK_VOLUME_UP.0
            || v == VK_MEDIA_NEXT_TRACK.0
            || v == VK_MEDIA_PREV_TRACK.0
            || v == VK_MEDIA_STOP.0
            || v == VK_MEDIA_PLAY_PAUSE.0
    )
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

unsafe extern "system" fn low_level_keyboard_proc(
    code: i32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if code >= 0 && HOOK_ACTIVE.load(Ordering::SeqCst) {
        let kb = &*(lparam.0 as *const KBDLLHOOKSTRUCT);
        let flags = kb.flags.0;
        let injected = (flags & (LLKHF_INJECTED.0 | LLKHF_LOWER_IL_INJECTED.0)) != 0;
        if !injected {
            let vk = kb.vkCode as u16;
            if is_catalogued_vk(vk) {
                let message = wparam.0 as u32;
                let pressed = matches!(message, WM_KEYDOWN | WM_SYSKEYDOWN);
                let is_up = matches!(message, WM_KEYUP | WM_SYSKEYUP);
                if pressed || is_up {
                    handle_catalogued_key(vk, pressed);
                }
                // Suppress OS handling for catalogued media/volume keys.
                return LRESULT(1);
            }
        }
    }
    unsafe { CallNextHookEx(None, code, wparam, lparam) }
}

fn install_hook() -> windows::core::Result<HHOOK> {
    unsafe {
        SetWindowsHookExW(
            WH_KEYBOARD_LL,
            Some(low_level_keyboard_proc),
            None,
            0,
        )
    }
}

pub struct KeyboardCapture {
    join: Option<JoinHandle<()>>,
}

impl KeyboardCapture {
    pub fn start(on_event: EventSink) -> Result<Self, String> {
        if HOOK_ACTIVE.swap(true, Ordering::SeqCst) {
            return Err("Keyboard capture already running".into());
        }

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
                let hook = match install_hook() {
                    Ok(hook) => hook,
                    Err(err) => {
                        HOOK_ACTIVE.store(false, Ordering::SeqCst);
                        run_logger::error(
                            "keyboard_input",
                            "hook_install_failed",
                            &format!("error={err}"),
                        );
                        return;
                    }
                };
                run_logger::info("keyboard_input", "hook_started", "global media/volume capture");

                let mut msg = MSG::default();
                unsafe {
                    while GetMessageW(&mut msg, None, 0, 0).into() {
                        let _ = TranslateMessage(&msg);
                        DispatchMessageW(&msg);
                    }
                    let _ = UnhookWindowsHookEx(hook);
                }
                HOOK_THREAD_ID.store(0, Ordering::SeqCst);
                run_logger::info("keyboard_input", "hook_stopped", "");
            })
            .map_err(|err| {
                HOOK_ACTIVE.store(false, Ordering::SeqCst);
                format!("Failed to start keyboard capture thread: {err}")
            })?;

        Ok(Self { join: Some(join) })
    }

    pub fn stop(&mut self) {
        if !HOOK_ACTIVE.swap(false, Ordering::SeqCst) {
            return;
        }
        let thread_id = HOOK_THREAD_ID.load(Ordering::SeqCst);
        if thread_id != 0 {
            unsafe {
                let _ = PostThreadMessageW(thread_id, WM_QUIT, WPARAM(0), LPARAM(0));
            }
        }
        if let Some(join) = self.join.take() {
            let _ = join.join();
        }
        if let Ok(mut sink) = event_sink_slot().lock() {
            *sink = None;
        }
    }
}

impl Drop for KeyboardCapture {
    fn drop(&mut self) {
        self.stop();
    }
}
