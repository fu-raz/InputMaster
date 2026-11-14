use crate::model::{MidiEvent, MidiMessageType};
use serde::Serialize;

pub const DEVICE_ID: &str = "keyboard:local";
pub const DEVICE_NAME: &str = "Keyboard / media keys";

pub const CHANNEL: u8 = 0;

pub const CTRL_VOLUME_MUTE: u8 = 1;
pub const CTRL_VOLUME_UP: u8 = 2;
pub const CTRL_VOLUME_DOWN: u8 = 3;
pub const CTRL_VOLUME_WHEEL: u8 = 7;
pub const CTRL_MEDIA_PLAY_PAUSE: u8 = 10;
pub const CTRL_MEDIA_NEXT: u8 = 11;
pub const CTRL_MEDIA_PREV: u8 = 12;
pub const CTRL_MEDIA_STOP: u8 = 13;

/// Reserved range for future discrete keys (e.g. F13–F24) without pipeline changes.
#[allow(dead_code)]
pub const CTRL_EXTENDED_BASE: u8 = 20;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyboardControlId {
    VolumeMute,
    /// Reserved for a future discrete Volume Up Note binding.
    #[allow(dead_code)]
    VolumeUp,
    /// Reserved for a future discrete Volume Down Note binding.
    #[allow(dead_code)]
    VolumeDown,
    VolumeWheel,
    MediaPlayPause,
    MediaNext,
    MediaPrev,
    MediaStop,
}

impl KeyboardControlId {
    pub fn controller(self) -> u8 {
        match self {
            Self::VolumeMute => CTRL_VOLUME_MUTE,
            Self::VolumeUp => CTRL_VOLUME_UP,
            Self::VolumeDown => CTRL_VOLUME_DOWN,
            Self::VolumeWheel => CTRL_VOLUME_WHEEL,
            Self::MediaPlayPause => CTRL_MEDIA_PLAY_PAUSE,
            Self::MediaNext => CTRL_MEDIA_NEXT,
            Self::MediaPrev => CTRL_MEDIA_PREV,
            Self::MediaStop => CTRL_MEDIA_STOP,
        }
    }

    pub fn msg_type(self) -> MidiMessageType {
        match self {
            Self::VolumeWheel => MidiMessageType::ControlChange,
            _ => MidiMessageType::Note,
        }
    }

    pub fn id_str(self) -> &'static str {
        match self {
            Self::VolumeMute => "volume_mute",
            Self::VolumeUp => "volume_up",
            Self::VolumeDown => "volume_down",
            Self::VolumeWheel => "volume_wheel",
            Self::MediaPlayPause => "media_play_pause",
            Self::MediaNext => "media_next",
            Self::MediaPrev => "media_prev",
            Self::MediaStop => "media_stop",
        }
    }

    pub fn display_name(self) -> &'static str {
        match self {
            Self::VolumeMute => "Volume Mute",
            Self::VolumeUp => "Volume Up",
            Self::VolumeDown => "Volume Down",
            Self::VolumeWheel => "Volume Wheel",
            Self::MediaPlayPause => "Play / Pause",
            Self::MediaNext => "Next Track",
            Self::MediaPrev => "Previous Track",
            Self::MediaStop => "Stop",
        }
    }

    pub fn is_continuous(self) -> bool {
        matches!(self, Self::VolumeWheel)
    }

    #[allow(dead_code)]
    pub fn from_controller(controller: u8, msg_type: &MidiMessageType) -> Option<Self> {
        match (controller, msg_type) {
            (CTRL_VOLUME_MUTE, MidiMessageType::Note) => Some(Self::VolumeMute),
            (CTRL_VOLUME_UP, MidiMessageType::Note) => Some(Self::VolumeUp),
            (CTRL_VOLUME_DOWN, MidiMessageType::Note) => Some(Self::VolumeDown),
            (CTRL_VOLUME_WHEEL, MidiMessageType::ControlChange) => Some(Self::VolumeWheel),
            (CTRL_MEDIA_PLAY_PAUSE, MidiMessageType::Note) => Some(Self::MediaPlayPause),
            (CTRL_MEDIA_NEXT, MidiMessageType::Note) => Some(Self::MediaNext),
            (CTRL_MEDIA_PREV, MidiMessageType::Note) => Some(Self::MediaPrev),
            (CTRL_MEDIA_STOP, MidiMessageType::Note) => Some(Self::MediaStop),
            _ => None,
        }
    }
}

/// Resolve a friendly label for binding UI when `device_id` is `keyboard:local`.
#[allow(dead_code)]
pub fn control_label_for(controller: u8, msg_type: &MidiMessageType) -> Option<&'static str> {
    KeyboardControlId::from_controller(controller, msg_type).map(|c| c.display_name())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardControlInfo {
    pub id: String,
    pub name: String,
    pub device_id: String,
    pub channel: u8,
    pub controller: u8,
    pub msg_type: MidiMessageType,
    pub continuous: bool,
}

pub fn catalog_controls() -> Vec<KeyboardControlInfo> {
    // Volume Up/Down Note slots stay reserved; capture uses the relative wheel instead.
    [
        KeyboardControlId::VolumeMute,
        KeyboardControlId::VolumeWheel,
        KeyboardControlId::MediaPlayPause,
        KeyboardControlId::MediaNext,
        KeyboardControlId::MediaPrev,
        KeyboardControlId::MediaStop,
    ]
    .into_iter()
    .map(|control| KeyboardControlInfo {
        id: control.id_str().to_string(),
        name: control.display_name().to_string(),
        device_id: DEVICE_ID.to_string(),
        channel: CHANNEL,
        controller: control.controller(),
        msg_type: control.msg_type(),
        continuous: control.is_continuous(),
    })
    .collect()
}

pub fn note_event(control: KeyboardControlId, pressed: bool) -> MidiEvent {
    MidiEvent {
        device_id: DEVICE_ID.to_string(),
        channel: CHANNEL,
        controller: control.controller(),
        value: if pressed { 127 } else { 0 },
        value_14: None,
        msg_type: MidiMessageType::Note,
    }
}

/// Twos-complement relative: +1 → 1, −1 → 127.
pub fn volume_wheel_event(delta: i8) -> Option<MidiEvent> {
    if delta == 0 {
        return None;
    }
    let value = if delta > 0 {
        delta.unsigned_abs().min(63)
    } else {
        (128i16 - i16::from(delta.unsigned_abs().min(63))) as u8
    };
    Some(MidiEvent {
        device_id: DEVICE_ID.to_string(),
        channel: CHANNEL,
        controller: CTRL_VOLUME_WHEEL,
        value,
        value_14: None,
        msg_type: MidiMessageType::ControlChange,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn volume_wheel_relative_encoding() {
        let up = volume_wheel_event(1).expect("up");
        assert_eq!(up.value, 1);
        assert_eq!(up.controller, CTRL_VOLUME_WHEEL);
        assert!(matches!(up.msg_type, MidiMessageType::ControlChange));

        let down = volume_wheel_event(-1).expect("down");
        assert_eq!(down.value, 127);
    }

    #[test]
    fn catalog_ids_are_stable() {
        let controls = catalog_controls();
        assert!(controls.iter().any(|c| c.controller == CTRL_VOLUME_WHEEL));
        assert!(controls.iter().any(|c| c.controller == CTRL_VOLUME_MUTE));
        assert!(!controls.iter().any(|c| c.controller == CTRL_VOLUME_UP));
        assert_eq!(
            control_label_for(CTRL_VOLUME_MUTE, &MidiMessageType::Note),
            Some("Volume Mute")
        );
        assert_eq!(
            control_label_for(CTRL_VOLUME_UP, &MidiMessageType::Note),
            Some("Volume Up")
        );
    }
}
