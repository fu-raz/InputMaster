use crate::model::{MidiEvent, MidiMessageType};
use serde::Serialize;

pub const MAX_SLOTS: usize = 4;
pub const CHANNEL: u8 = 0;

pub fn device_id_for_slot(slot: u8) -> String {
    format!("controller:xinput:{slot}")
}

#[allow(dead_code)]
pub fn parse_xinput_slot(device_id: &str) -> Option<u8> {
    let rest = device_id.strip_prefix("controller:xinput:")?;
    let slot: u8 = rest.parse().ok()?;
    if (slot as usize) < MAX_SLOTS {
        Some(slot)
    } else {
        None
    }
}

#[allow(dead_code)]
pub fn is_controller_device_id(device_id: &str) -> bool {
    parse_xinput_slot(device_id).is_some()
}

pub fn device_name_for_slot(slot: u8) -> String {
    format!("Controller {}", slot + 1)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ControllerControlId {
    A,
    B,
    X,
    Y,
    LeftShoulder,
    RightShoulder,
    Back,
    Start,
    LeftThumb,
    RightThumb,
    DpadUp,
    DpadDown,
    DpadLeft,
    DpadRight,
    LeftStickX,
    LeftStickY,
    RightStickX,
    RightStickY,
    LeftTrigger,
    RightTrigger,
}

impl ControllerControlId {
    pub fn controller(self) -> u8 {
        match self {
            Self::A => 1,
            Self::B => 2,
            Self::X => 3,
            Self::Y => 4,
            Self::LeftShoulder => 5,
            Self::RightShoulder => 6,
            Self::Back => 7,
            Self::Start => 8,
            Self::LeftThumb => 9,
            Self::RightThumb => 10,
            Self::DpadUp => 11,
            Self::DpadDown => 12,
            Self::DpadLeft => 13,
            Self::DpadRight => 14,
            Self::LeftStickX => 20,
            Self::LeftStickY => 21,
            Self::RightStickX => 22,
            Self::RightStickY => 23,
            Self::LeftTrigger => 24,
            Self::RightTrigger => 25,
        }
    }

    pub fn msg_type(self) -> MidiMessageType {
        if self.is_continuous() {
            MidiMessageType::ControlChange
        } else {
            MidiMessageType::Note
        }
    }

    pub fn id_str(self) -> &'static str {
        match self {
            Self::A => "a",
            Self::B => "b",
            Self::X => "x",
            Self::Y => "y",
            Self::LeftShoulder => "left_shoulder",
            Self::RightShoulder => "right_shoulder",
            Self::Back => "back",
            Self::Start => "start",
            Self::LeftThumb => "left_thumb",
            Self::RightThumb => "right_thumb",
            Self::DpadUp => "dpad_up",
            Self::DpadDown => "dpad_down",
            Self::DpadLeft => "dpad_left",
            Self::DpadRight => "dpad_right",
            Self::LeftStickX => "left_stick_x",
            Self::LeftStickY => "left_stick_y",
            Self::RightStickX => "right_stick_x",
            Self::RightStickY => "right_stick_y",
            Self::LeftTrigger => "left_trigger",
            Self::RightTrigger => "right_trigger",
        }
    }

    pub fn display_name(self) -> &'static str {
        match self {
            Self::A => "A",
            Self::B => "B",
            Self::X => "X",
            Self::Y => "Y",
            Self::LeftShoulder => "Left Bumper",
            Self::RightShoulder => "Right Bumper",
            Self::Back => "Back / View",
            Self::Start => "Start / Menu",
            Self::LeftThumb => "Left Stick Click",
            Self::RightThumb => "Right Stick Click",
            Self::DpadUp => "D-Pad Up",
            Self::DpadDown => "D-Pad Down",
            Self::DpadLeft => "D-Pad Left",
            Self::DpadRight => "D-Pad Right",
            Self::LeftStickX => "Left Stick X",
            Self::LeftStickY => "Left Stick Y",
            Self::RightStickX => "Right Stick X",
            Self::RightStickY => "Right Stick Y",
            Self::LeftTrigger => "Left Trigger",
            Self::RightTrigger => "Right Trigger",
        }
    }

    pub fn is_continuous(self) -> bool {
        matches!(
            self,
            Self::LeftStickX
                | Self::LeftStickY
                | Self::RightStickX
                | Self::RightStickY
                | Self::LeftTrigger
                | Self::RightTrigger
        )
    }

    #[allow(dead_code)]
    pub fn from_controller(controller: u8, msg_type: &MidiMessageType) -> Option<Self> {
        match (controller, msg_type) {
            (1, MidiMessageType::Note) => Some(Self::A),
            (2, MidiMessageType::Note) => Some(Self::B),
            (3, MidiMessageType::Note) => Some(Self::X),
            (4, MidiMessageType::Note) => Some(Self::Y),
            (5, MidiMessageType::Note) => Some(Self::LeftShoulder),
            (6, MidiMessageType::Note) => Some(Self::RightShoulder),
            (7, MidiMessageType::Note) => Some(Self::Back),
            (8, MidiMessageType::Note) => Some(Self::Start),
            (9, MidiMessageType::Note) => Some(Self::LeftThumb),
            (10, MidiMessageType::Note) => Some(Self::RightThumb),
            (11, MidiMessageType::Note) => Some(Self::DpadUp),
            (12, MidiMessageType::Note) => Some(Self::DpadDown),
            (13, MidiMessageType::Note) => Some(Self::DpadLeft),
            (14, MidiMessageType::Note) => Some(Self::DpadRight),
            (20, MidiMessageType::ControlChange) => Some(Self::LeftStickX),
            (21, MidiMessageType::ControlChange) => Some(Self::LeftStickY),
            (22, MidiMessageType::ControlChange) => Some(Self::RightStickX),
            (23, MidiMessageType::ControlChange) => Some(Self::RightStickY),
            (24, MidiMessageType::ControlChange) => Some(Self::LeftTrigger),
            (25, MidiMessageType::ControlChange) => Some(Self::RightTrigger),
            _ => None,
        }
    }
}

#[allow(dead_code)]
pub fn control_label_for(controller: u8, msg_type: &MidiMessageType) -> Option<&'static str> {
    ControllerControlId::from_controller(controller, msg_type).map(|c| c.display_name())
}

pub const BUTTON_COUNT: u8 = 14;
pub const FADER_COUNT: u8 = 6; // sticks (4) + triggers (2); sticks count as faders
pub const KNOB_COUNT: u8 = 0;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ControllerDeviceInfo {
    pub slot: u8,
    pub device_id: String,
    pub device_name: String,
    pub connected: bool,
    pub enabled: bool,
    pub button_count: u8,
    pub fader_count: u8,
    pub knob_count: u8,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ControllerControlInfo {
    pub id: String,
    pub name: String,
    pub controller: u8,
    pub msg_type: MidiMessageType,
    pub continuous: bool,
}

pub fn catalog_controls() -> Vec<ControllerControlInfo> {
    [
        ControllerControlId::A,
        ControllerControlId::B,
        ControllerControlId::X,
        ControllerControlId::Y,
        ControllerControlId::LeftShoulder,
        ControllerControlId::RightShoulder,
        ControllerControlId::Back,
        ControllerControlId::Start,
        ControllerControlId::LeftThumb,
        ControllerControlId::RightThumb,
        ControllerControlId::DpadUp,
        ControllerControlId::DpadDown,
        ControllerControlId::DpadLeft,
        ControllerControlId::DpadRight,
        ControllerControlId::LeftStickX,
        ControllerControlId::LeftStickY,
        ControllerControlId::RightStickX,
        ControllerControlId::RightStickY,
        ControllerControlId::LeftTrigger,
        ControllerControlId::RightTrigger,
    ]
    .into_iter()
    .map(|control| ControllerControlInfo {
        id: control.id_str().to_string(),
        name: control.display_name().to_string(),
        controller: control.controller(),
        msg_type: control.msg_type(),
        continuous: control.is_continuous(),
    })
    .collect()
}

pub fn note_event(slot: u8, control: ControllerControlId, pressed: bool) -> MidiEvent {
    MidiEvent {
        device_id: device_id_for_slot(slot),
        channel: CHANNEL,
        controller: control.controller(),
        value: if pressed { 127 } else { 0 },
        value_14: None,
        msg_type: MidiMessageType::Note,
    }
}

pub fn axis_event(slot: u8, control: ControllerControlId, value: u8) -> MidiEvent {
    MidiEvent {
        device_id: device_id_for_slot(slot),
        channel: CHANNEL,
        controller: control.controller(),
        value,
        value_14: None,
        msg_type: MidiMessageType::ControlChange,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn device_ids_round_trip() {
        assert_eq!(device_id_for_slot(0), "controller:xinput:0");
        assert_eq!(parse_xinput_slot("controller:xinput:2"), Some(2));
        assert!(parse_xinput_slot("controller:xinput:9").is_none());
        assert!(!is_controller_device_id("keyboard:local"));
    }
}
