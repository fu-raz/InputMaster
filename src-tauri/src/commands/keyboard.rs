use crate::app_settings::AppSettings;
use crate::keyboard_input::{self, KeyboardControlInfo, DEVICE_ID, DEVICE_NAME};
use crate::run_logger;
use crate::settings_services::persist_app_settings_update;
use crate::AppState;
use serde::Serialize;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardInputStatus {
    pub enabled: bool,
    pub supported: bool,
    pub device_id: String,
    pub device_name: String,
    pub controls: Vec<KeyboardControlInfo>,
}

pub(crate) fn keyboard_event_callback(
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

pub(crate) fn apply_keyboard_input_enabled(
    app: &AppHandle,
    state: &AppState,
    enabled: bool,
) -> Result<bool, String> {
    let mut keyboard = state
        .keyboard_input
        .lock()
        .map_err(|_| "Lock poisoned".to_string())?;
    keyboard.set_event_sink(keyboard_event_callback(app.clone()));
    let active = keyboard.set_enabled(enabled)?;
    Ok(active)
}

#[tauri::command]
pub fn get_keyboard_input_status(state: State<AppState>) -> Result<KeyboardInputStatus, String> {
    let enabled = state
        .keyboard_input
        .lock()
        .map(|keyboard| keyboard.is_enabled())
        .map_err(|_| "Lock poisoned".to_string())?;
    Ok(KeyboardInputStatus {
        enabled,
        supported: cfg!(target_os = "windows"),
        device_id: DEVICE_ID.to_string(),
        device_name: DEVICE_NAME.to_string(),
        controls: keyboard_input::catalog_controls(),
    })
}

#[tauri::command]
pub fn set_keyboard_input_enabled(
    app: AppHandle,
    state: State<AppState>,
    enabled: bool,
) -> Result<AppSettings, String> {
    let active = apply_keyboard_input_enabled(&app, state.inner(), enabled)?;
    persist_app_settings_update(state.inner(), |settings| {
        settings.keyboard_input_enabled = active;
    })
}

#[tauri::command]
pub fn list_keyboard_controls() -> Vec<KeyboardControlInfo> {
    keyboard_input::catalog_controls()
}
