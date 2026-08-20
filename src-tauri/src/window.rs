use std::sync::atomic::{AtomicU32, Ordering};

use tauri::{AppHandle, WebviewWindowBuilder};

static WINDOW_COUNTER: AtomicU32 = AtomicU32::new(1);

pub fn open_new_window(app: &AppHandle) -> Result<(), String> {
    let mut config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == "main")
        .ok_or("missing main window config")?
        .clone();

    let id = WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed);
    config.label = format!("window-{id}");

    let window = WebviewWindowBuilder::from_config(app, &config)
        .map_err(|err| err.to_string())?
        .build()
        .map_err(|err| err.to_string())?;

    #[cfg(target_os = "macos")]
    crate::macos::install(&window);

    window.set_focus().map_err(|err| err.to_string())?;
    Ok(())
}
