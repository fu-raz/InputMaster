mod catalog;

#[cfg(target_os = "windows")]
mod poll_windows;

pub use catalog::{
    catalog_controls, ControllerControlInfo, ControllerDeviceInfo, BUTTON_COUNT, FADER_COUNT,
    KNOB_COUNT, MAX_SLOTS,
};

use crate::model::MidiEvent;
use crate::run_logger;
use std::sync::Arc;

#[cfg(target_os = "windows")]
use poll_windows::{ControllerPoller, SLOT_MASK_ALL};

type EventSink = Arc<dyn Fn(MidiEvent) + Send + Sync + 'static>;

pub fn slot_mask_from_preference(slots: Option<&[u8]>) -> u8 {
    match slots {
        None => {
            #[cfg(target_os = "windows")]
            {
                SLOT_MASK_ALL
            }
            #[cfg(not(target_os = "windows"))]
            {
                0b1111
            }
        }
        Some(list) => {
            let mut mask = 0u8;
            for slot in list {
                if (*slot as usize) < MAX_SLOTS {
                    mask |= 1 << slot;
                }
            }
            mask
        }
    }
}

pub fn preference_from_slot_mask(mask: u8) -> Option<Vec<u8>> {
    #[cfg(target_os = "windows")]
    let all = SLOT_MASK_ALL;
    #[cfg(not(target_os = "windows"))]
    let all = 0b1111u8;
    if mask & all == all {
        return None;
    }
    let mut slots = Vec::new();
    for slot in 0..MAX_SLOTS {
        if mask & (1 << slot) != 0 {
            slots.push(slot as u8);
        }
    }
    Some(slots)
}

pub struct ControllerInputManager {
    #[cfg(target_os = "windows")]
    poller: Option<ControllerPoller>,
    enabled: bool,
    slot_mask: u8,
    on_event: Option<EventSink>,
}

impl Default for ControllerInputManager {
    fn default() -> Self {
        Self::new()
    }
}

impl ControllerInputManager {
    pub fn new() -> Self {
        Self {
            #[cfg(target_os = "windows")]
            poller: None,
            enabled: false,
            slot_mask: {
                #[cfg(target_os = "windows")]
                {
                    SLOT_MASK_ALL
                }
                #[cfg(not(target_os = "windows"))]
                {
                    0b1111
                }
            },
            on_event: None,
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    pub fn set_event_sink(&mut self, on_event: EventSink) {
        self.on_event = Some(on_event);
        if self.enabled {
            let _ = self.ensure_started();
        }
    }

    pub fn set_slot_mask(&mut self, mask: u8) {
        self.slot_mask = mask & 0b1111;
        #[cfg(target_os = "windows")]
        if let Some(poller) = self.poller.as_ref() {
            poller.set_slot_mask(self.slot_mask);
        }
    }

    pub fn set_slot_enabled(&mut self, slot: u8, enabled: bool) -> u8 {
        if (slot as usize) >= MAX_SLOTS {
            return self.slot_mask;
        }
        if enabled {
            self.slot_mask |= 1 << slot;
        } else {
            self.slot_mask &= !(1 << slot);
        }
        self.set_slot_mask(self.slot_mask);
        self.slot_mask
    }

    pub fn set_enabled(&mut self, enabled: bool) -> Result<bool, String> {
        if enabled == self.enabled {
            return Ok(self.enabled);
        }
        if enabled {
            self.enabled = true;
            self.ensure_started()?;
            run_logger::info("controller_input", "enabled", "");
        } else {
            self.stop_poller();
            self.enabled = false;
            run_logger::info("controller_input", "disabled", "");
        }
        Ok(self.enabled)
    }

    pub fn stop(&mut self) {
        self.stop_poller();
        self.enabled = false;
    }

    pub fn connected_devices(&self) -> Vec<ControllerDeviceInfo> {
        #[cfg(target_os = "windows")]
        {
            if let Some(poller) = self.poller.as_ref() {
                return poller.connected_devices();
            }
        }
        Vec::new()
    }

    #[cfg(target_os = "windows")]
    fn ensure_started(&mut self) -> Result<(), String> {
        if self.poller.is_some() {
            return Ok(());
        }
        let sink = self
            .on_event
            .clone()
            .ok_or_else(|| "Controller input event sink is not configured".to_string())?;
        self.poller = Some(ControllerPoller::start(sink, self.slot_mask));
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    fn ensure_started(&mut self) -> Result<(), String> {
        Err("Controller input is only supported on Windows".into())
    }

    #[cfg(target_os = "windows")]
    fn stop_poller(&mut self) {
        if let Some(mut poller) = self.poller.take() {
            poller.stop();
        }
    }

    #[cfg(not(target_os = "windows"))]
    fn stop_poller(&mut self) {}
}
