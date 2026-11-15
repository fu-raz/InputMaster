mod catalog;

#[cfg(target_os = "windows")]
mod poll_windows;

pub use catalog::{
    catalog_controls, ControllerControlInfo, ControllerDeviceInfo,
};

use crate::model::MidiEvent;
use crate::run_logger;
use std::sync::Arc;

#[cfg(target_os = "windows")]
use poll_windows::ControllerPoller;

type EventSink = Arc<dyn Fn(MidiEvent) + Send + Sync + 'static>;

pub struct ControllerInputManager {
    #[cfg(target_os = "windows")]
    poller: Option<ControllerPoller>,
    enabled: bool,
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
        self.poller = Some(ControllerPoller::start(sink));
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
