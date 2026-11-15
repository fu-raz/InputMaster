mod catalog;

#[cfg(target_os = "windows")]
mod capture_windows;

pub use catalog::{
    capture_controls, catalog_controls, catalog_controls_with_enabled, default_enabled_control_ids,
    enabled_mask_from_preference, KeyboardControlId, KeyboardControlInfo, DEVICE_ID, DEVICE_NAME,
    MASK_ALL,
};

use crate::model::MidiEvent;
use crate::run_logger;
use std::sync::Arc;

#[cfg(target_os = "windows")]
use capture_windows::KeyboardCapture;

/// Synthesize a media VK for binding actions without our capture path swallowing it.
#[cfg(target_os = "windows")]
pub fn send_media_key_bypassing_capture(vk: u16) {
    capture_windows::send_media_key_bypassing_capture(vk);
}

#[cfg(not(target_os = "windows"))]
pub fn send_media_key_bypassing_capture(vk: u16) {
    crate::runtime_helpers::send_media_key(vk);
}

type EventSink = Arc<dyn Fn(MidiEvent) + Send + Sync + 'static>;

pub struct KeyboardInputManager {
    #[cfg(target_os = "windows")]
    capture: Option<KeyboardCapture>,
    enabled: bool,
    enabled_mask: u32,
    on_event: Option<EventSink>,
}

impl Default for KeyboardInputManager {
    fn default() -> Self {
        Self::new()
    }
}

impl KeyboardInputManager {
    pub fn new() -> Self {
        Self {
            #[cfg(target_os = "windows")]
            capture: None,
            enabled: false,
            enabled_mask: MASK_ALL,
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

    pub fn set_enabled_mask(&mut self, mask: u32) {
        self.enabled_mask = mask;
        #[cfg(target_os = "windows")]
        if let Some(capture) = self.capture.as_mut() {
            capture.set_enabled_mask(mask);
        }
        #[cfg(target_os = "windows")]
        if self.capture.is_none() {
            capture_windows::set_global_enabled_mask(mask);
        }
    }

    pub fn set_enabled(&mut self, enabled: bool) -> Result<bool, String> {
        if enabled == self.enabled {
            return Ok(self.enabled);
        }
        if enabled {
            self.enabled = true;
            self.ensure_started()?;
            run_logger::info("keyboard_input", "enabled", DEVICE_ID);
        } else {
            self.stop_capture();
            self.enabled = false;
            run_logger::info("keyboard_input", "disabled", DEVICE_ID);
        }
        Ok(self.enabled)
    }

    pub fn stop(&mut self) {
        self.stop_capture();
        self.enabled = false;
    }

    #[cfg(target_os = "windows")]
    fn ensure_started(&mut self) -> Result<(), String> {
        if self.capture.is_some() {
            return Ok(());
        }
        let sink = self
            .on_event
            .clone()
            .ok_or_else(|| "Keyboard input event sink is not configured".to_string())?;
        self.capture = Some(KeyboardCapture::start(sink, self.enabled_mask)?);
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    fn ensure_started(&mut self) -> Result<(), String> {
        Err("Keyboard input is only supported on Windows".into())
    }

    #[cfg(target_os = "windows")]
    fn stop_capture(&mut self) {
        if let Some(mut capture) = self.capture.take() {
            capture.stop();
        }
    }

    #[cfg(not(target_os = "windows"))]
    fn stop_capture(&mut self) {}
}
