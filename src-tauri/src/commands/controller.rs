use crate::controller_input::{
    self, catalog_controls, ControllerControlInfo, ControllerDeviceInfo,
};
use crate::run_logger;
use crate::settings_services::persist_app_settings_update;
use crate::AppState;
use serde::Serialize;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ControllerInputStatus {
    pub enabled: bool,
    pub supported: bool,
    pub observe_only: bool,
    pub devices: Vec<ControllerDeviceInfo>,
    pub controls: Vec<ControllerControlInfo>,
}

pub(crate) fn controller_event_callback(
    app_handle: AppHandle,
) -> Arc<dyn Fn(crate::model::MidiEvent) + Send + Sync + 'static> {
    Arc::new(move |event| {
        let state = app_handle.state::<AppState>();
        let enqueue_result = state.midi_event_queue.lock();
        match enqueue_result {
            Ok(mut queue) => {
                queue.enqueue(event);
                crate::background_tasks::notify_midi_event_queued();
            }
            Err(_) => run_logger::error("midi_queue", "enqueue_failed", "queue lock poisoned"),
        };
    })
}

pub(crate) fn apply_controller_input_enabled(
    app: &AppHandle,
    state: &AppState,
    enabled: bool,
) -> Result<bool, String> {
    let mut controller = state
        .controller_input
        .lock()
        .map_err(|_| "Lock poisoned".to_string())?;
    controller.set_event_sink(controller_event_callback(app.clone()));
    let active = controller.set_enabled(enabled)?;
    Ok(active)
}

#[tauri::command]
pub fn get_controller_input_status(
    state: State<AppState>,
) -> Result<ControllerInputStatus, String> {
    let controller = state
        .controller_input
        .lock()
        .map_err(|_| "Lock poisoned".to_string())?;
    Ok(ControllerInputStatus {
        enabled: controller.is_enabled(),
        supported: cfg!(target_os = "windows"),
        observe_only: true,
        devices: controller.connected_devices(),
        controls: catalog_controls(),
    })
}

#[tauri::command]
pub fn set_controller_input_enabled(
    app: AppHandle,
    state: State<AppState>,
    enabled: bool,
) -> Result<crate::app_settings::AppSettings, String> {
    let active = apply_controller_input_enabled(&app, state.inner(), enabled)?;
    persist_app_settings_update(state.inner(), |settings| {
        settings.controller_input_enabled = active;
    })
}

#[tauri::command]
pub fn list_controller_controls() -> Vec<ControllerControlInfo> {
    controller_input::catalog_controls()
}
