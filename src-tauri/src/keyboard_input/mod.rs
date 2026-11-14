mod catalog;

#[cfg(target_os = "windows")]
mod capture_windows;

pub use catalog::{catalog_controls, KeyboardControlInfo, DEVICE_ID, DEVICE_NAME};

use crate::model::MidiEvent;
use crate::run_logger;
use std::sync::Arc;

#[cfg(target_os = "windows")]
use capture_windows::KeyboardCapture;

type EventSink = Arc<dyn Fn(MidiEvent) + Send + Sync + 'static>;

pub struct KeyboardInputManager {
    #[cfg(target_os = "windows")]
    capture: Option<KeyboardCapture>,
    enabled: bool,
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
        self.capture = Some(KeyboardCapture::start(sink)?);
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
