use std::path::PathBuf;

use tauri::Manager;

pub const APP_DATA_DIR_NAME: &str = "InputMaster";
// Prefer InputMaster; migrate once from older friendly/identifier folders.
const LEGACY_TAURI_IDENTIFIER_DIRS: &[&str] = &["MIDIMaster", "com.midimaster.app", "com.midimaster.midimaster"];

#[cfg(feature = "perf-audit")]
const PERF_APP_DATA_ENV: &str = "MIDIMASTER_PERF_APP_DATA_DIR";

#[cfg(feature = "perf-audit")]
fn perf_app_data_override(raw: &str) -> Result<PathBuf, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(format!("{PERF_APP_DATA_ENV} must not be empty"));
    }
    let path = PathBuf::from(trimmed);
    if !path.is_absolute() {
        return Err(format!("{PERF_APP_DATA_ENV} must be an absolute path"));
    }
    Ok(path)
}

pub fn app_data_root_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    #[cfg(feature = "perf-audit")]
    if let Some(raw) = std::env::var_os(PERF_APP_DATA_ENV) {
        let raw = raw
            .to_str()
            .ok_or_else(|| format!("{PERF_APP_DATA_ENV} must contain valid Unicode"))?;
        let desired = perf_app_data_override(raw)?;
        std::fs::create_dir_all(&desired).map_err(|e| e.to_string())?;
        return Ok(desired);
    }

    let default_dir = app
        .path()
        .app_config_dir()
        .map_err(|_| "Unable to resolve config directory".to_string())?;

    // Tauri's app_config_dir is derived from the bundle identifier
    // (e.g. "com.midimaster.app"). For user-friendliness we prefer a
    // stable, human-readable folder name.
    let base = default_dir.parent().unwrap_or(&default_dir);
    let desired = base.join(APP_DATA_DIR_NAME);

    // One-time migration for existing installs.
    // Prefer the old friendly MIDIMaster folder before identifier-derived dirs
    // (those are often empty shells). Best-effort: on failure, start fresh.
    if !desired.exists() {
        let mut candidates: Vec<PathBuf> = LEGACY_TAURI_IDENTIFIER_DIRS
            .iter()
            .map(|name| base.join(name))
            .collect();
        if !candidates.iter().any(|path| path == &default_dir) {
            candidates.push(default_dir.clone());
        }
        for legacy_dir in candidates {
            if legacy_dir.exists() && legacy_dir != desired {
                let _ = std::fs::rename(&legacy_dir, &desired);
                break;
            }
        }
    }

    std::fs::create_dir_all(&desired).map_err(|e| e.to_string())?;
    Ok(desired)
}
