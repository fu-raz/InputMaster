//! Observe-only XInput poller. Games still receive every press; we only mirror state.

use super::catalog::{
    axis_event, device_id_for_slot, device_name_for_slot, note_event, ControllerControlId,
    ControllerDeviceInfo, MAX_SLOTS,
};
use crate::model::MidiEvent;
use crate::run_logger;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;
use windows::Win32::UI::Input::XboxController::{
    XInputGetState, XINPUT_GAMEPAD, XINPUT_GAMEPAD_A, XINPUT_GAMEPAD_B, XINPUT_GAMEPAD_BACK,
    XINPUT_GAMEPAD_DPAD_DOWN, XINPUT_GAMEPAD_DPAD_LEFT, XINPUT_GAMEPAD_DPAD_RIGHT,
    XINPUT_GAMEPAD_DPAD_UP, XINPUT_GAMEPAD_LEFT_SHOULDER, XINPUT_GAMEPAD_LEFT_THUMB,
    XINPUT_GAMEPAD_RIGHT_SHOULDER, XINPUT_GAMEPAD_RIGHT_THUMB, XINPUT_GAMEPAD_START,
    XINPUT_GAMEPAD_X, XINPUT_GAMEPAD_Y, XINPUT_STATE,
};

type EventSink = Arc<dyn Fn(MidiEvent) + Send + Sync + 'static>;

const POLL_INTERVAL: Duration = Duration::from_millis(16);
const LEFT_THUMB_DEADZONE: i32 = 7849;
const RIGHT_THUMB_DEADZONE: i32 = 8689;
const TRIGGER_THRESHOLD: u8 = 30;
const AXIS_DELTA_MIN: u8 = 2;

#[derive(Clone, Copy, Default)]
struct SlotSnapshot {
    connected: bool,
    buttons: u16,
    left_trigger: u8,
    right_trigger: u8,
    left_x: u8,
    left_y: u8,
    right_x: u8,
    right_y: u8,
}

struct SharedState {
    devices: [ControllerDeviceInfo; MAX_SLOTS],
}

pub struct ControllerPoller {
    stop: Arc<AtomicBool>,
    join: Option<JoinHandle<()>>,
    shared: Arc<Mutex<SharedState>>,
}

impl ControllerPoller {
    pub fn start(sink: EventSink) -> Self {
        let stop = Arc::new(AtomicBool::new(false));
        let shared = Arc::new(Mutex::new(SharedState {
            devices: std::array::from_fn(|slot| ControllerDeviceInfo {
                slot: slot as u8,
                device_id: device_id_for_slot(slot as u8),
                device_name: device_name_for_slot(slot as u8),
                connected: false,
            }),
        }));
        let stop_flag = Arc::clone(&stop);
        let shared_clone = Arc::clone(&shared);
        let join = thread::Builder::new()
            .name("controller-xinput-poll".into())
            .spawn(move || poll_loop(stop_flag, shared_clone, sink))
            .ok();
        if join.is_some() {
            run_logger::info("controller_input", "poll_started", "");
        } else {
            run_logger::warn("controller_input", "poll_spawn_failed", "");
        }
        Self {
            stop,
            join,
            shared,
        }
    }

    pub fn stop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(handle) = self.join.take() {
            let _ = handle.join();
        }
        run_logger::info("controller_input", "poll_stopped", "");
    }

    pub fn connected_devices(&self) -> Vec<ControllerDeviceInfo> {
        self.shared
            .lock()
            .map(|state| {
                state
                    .devices
                    .iter()
                    .filter(|d| d.connected)
                    .cloned()
                    .collect()
            })
            .unwrap_or_default()
    }
}

impl Drop for ControllerPoller {
    fn drop(&mut self) {
        self.stop();
    }
}

fn poll_loop(stop: Arc<AtomicBool>, shared: Arc<Mutex<SharedState>>, sink: EventSink) {
    let mut previous = [SlotSnapshot::default(); MAX_SLOTS];
    while !stop.load(Ordering::Relaxed) {
        for slot in 0..MAX_SLOTS {
            let mut state = XINPUT_STATE::default();
            let result = unsafe { XInputGetState(slot as u32, &mut state) };
            let connected = result == 0;
            let snapshot = if connected {
                snapshot_from_gamepad(&state.Gamepad)
            } else {
                SlotSnapshot::default()
            };

            if connected != previous[slot].connected {
                if let Ok(mut guard) = shared.lock() {
                    guard.devices[slot].connected = connected;
                }
                run_logger::info(
                    "controller_input",
                    if connected {
                        "device_connected"
                    } else {
                        "device_disconnected"
                    },
                    &device_id_for_slot(slot as u8),
                );
            }

            if connected {
                emit_deltas(slot as u8, &previous[slot], &snapshot, &sink);
            } else if previous[slot].connected {
                // Emit releases for any held buttons when the pad disappears.
                emit_button_releases(slot as u8, previous[slot].buttons, &sink);
            }

            previous[slot] = snapshot;
            previous[slot].connected = connected;
        }
        thread::sleep(POLL_INTERVAL);
    }
}

fn snapshot_from_gamepad(pad: &XINPUT_GAMEPAD) -> SlotSnapshot {
    SlotSnapshot {
        connected: true,
        buttons: pad.wButtons.0,
        left_trigger: quantize_trigger(pad.bLeftTrigger),
        right_trigger: quantize_trigger(pad.bRightTrigger),
        left_x: quantize_stick(pad.sThumbLX, LEFT_THUMB_DEADZONE),
        left_y: quantize_stick(pad.sThumbLY, LEFT_THUMB_DEADZONE),
        right_x: quantize_stick(pad.sThumbRX, RIGHT_THUMB_DEADZONE),
        right_y: quantize_stick(pad.sThumbRY, RIGHT_THUMB_DEADZONE),
    }
}

fn quantize_stick(value: i16, deadzone: i32) -> u8 {
    let v = value as i32;
    if v > -deadzone && v < deadzone {
        return 64;
    }
    let clamped = v.clamp(-32767, 32767);
    let normalized = (clamped + 32767) as f32 / 65534.0;
    (normalized * 127.0).round().clamp(0.0, 127.0) as u8
}

fn quantize_trigger(value: u8) -> u8 {
    if value < TRIGGER_THRESHOLD {
        return 0;
    }
    let span = 255u16.saturating_sub(TRIGGER_THRESHOLD as u16);
    if span == 0 {
        return 0;
    }
    let scaled = ((value as u16).saturating_sub(TRIGGER_THRESHOLD as u16) * 127) / span;
    scaled.min(127) as u8
}

fn emit_deltas(slot: u8, prev: &SlotSnapshot, next: &SlotSnapshot, sink: &EventSink) {
    for (mask, control) in BUTTON_MAP {
        let was = (prev.buttons & mask) != 0;
        let now = (next.buttons & mask) != 0;
        if was != now {
            sink(note_event(slot, control, now));
        }
    }

    emit_axis_if_changed(slot, ControllerControlId::LeftTrigger, prev.left_trigger, next.left_trigger, sink);
    emit_axis_if_changed(
        slot,
        ControllerControlId::RightTrigger,
        prev.right_trigger,
        next.right_trigger,
        sink,
    );
    emit_axis_if_changed(slot, ControllerControlId::LeftStickX, prev.left_x, next.left_x, sink);
    emit_axis_if_changed(slot, ControllerControlId::LeftStickY, prev.left_y, next.left_y, sink);
    emit_axis_if_changed(slot, ControllerControlId::RightStickX, prev.right_x, next.right_x, sink);
    emit_axis_if_changed(slot, ControllerControlId::RightStickY, prev.right_y, next.right_y, sink);
}

fn emit_axis_if_changed(
    slot: u8,
    control: ControllerControlId,
    prev: u8,
    next: u8,
    sink: &EventSink,
) {
    if prev == next {
        return;
    }
    if prev.abs_diff(next) < AXIS_DELTA_MIN && next != 0 && next != 64 && next != 127 {
        return;
    }
    sink(axis_event(slot, control, next));
}

fn emit_button_releases(slot: u8, buttons: u16, sink: &EventSink) {
    for (mask, control) in BUTTON_MAP {
        if (buttons & mask) != 0 {
            sink(note_event(slot, control, false));
        }
    }
}

const BUTTON_MAP: [(u16, ControllerControlId); 14] = [
    (XINPUT_GAMEPAD_A.0, ControllerControlId::A),
    (XINPUT_GAMEPAD_B.0, ControllerControlId::B),
    (XINPUT_GAMEPAD_X.0, ControllerControlId::X),
    (XINPUT_GAMEPAD_Y.0, ControllerControlId::Y),
    (XINPUT_GAMEPAD_LEFT_SHOULDER.0, ControllerControlId::LeftShoulder),
    (XINPUT_GAMEPAD_RIGHT_SHOULDER.0, ControllerControlId::RightShoulder),
    (XINPUT_GAMEPAD_BACK.0, ControllerControlId::Back),
    (XINPUT_GAMEPAD_START.0, ControllerControlId::Start),
    (XINPUT_GAMEPAD_LEFT_THUMB.0, ControllerControlId::LeftThumb),
    (XINPUT_GAMEPAD_RIGHT_THUMB.0, ControllerControlId::RightThumb),
    (XINPUT_GAMEPAD_DPAD_UP.0, ControllerControlId::DpadUp),
    (XINPUT_GAMEPAD_DPAD_DOWN.0, ControllerControlId::DpadDown),
    (XINPUT_GAMEPAD_DPAD_LEFT.0, ControllerControlId::DpadLeft),
    (XINPUT_GAMEPAD_DPAD_RIGHT.0, ControllerControlId::DpadRight),
];
