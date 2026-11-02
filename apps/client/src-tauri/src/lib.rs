mod event_sink;
mod local_shell;
mod secure;
mod sftp;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Runtime};
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // The updater plugin requires `plugins.updater` in tauri.conf.json with
    // valid `endpoints` + `pubkey`. The release workflow injects those via
    // `--config` at build time (see .github/workflows/release.yml), so the
    // committed config doesn't carry the placeholder. Loading the plugin in
    // a debug build would therefore panic with `invalid type: null` on every
    // `pnpm dev:client` start, so we skip it — the user only ever triggers
    // an update from a release build anyway.
    let builder = tauri::Builder::default();
    #[cfg(not(debug_assertions))]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .setup(|app| {
            app.set_menu(build_menu(app.handle())?)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let Some(window) = app.get_webview_window("main") else {
                return;
            };
            // Tab items emit events the frontend's session shortcuts listen
            // for (features/app/TopBar.tsx); the menu owns these accelerators
            // on macOS, so the webview never sees the keystrokes themselves.
            let tab_event = match event.id().0.as_str() {
                "tab-next" => Some("tab://next"),
                "tab-prev" => Some("tab://prev"),
                "tab-new-local" => Some("tab://new-local"),
                "tab-close" => Some("tab://close"),
                "window-close" => {
                    let _ = window.close();
                    None
                }
                _ => None,
            };
            if let Some(name) = tab_event {
                let _ = window.emit(name, ());
            }
        })
        .manage(std::sync::Arc::new(
            trominal_core::LocalShellState::default(),
        ))
        .manage(std::sync::Arc::new(sftp::SftpState::default()))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            secure::secure_set,
            secure::secure_get,
            secure::secure_delete,
            local_shell::local_shell_open,
            local_shell::local_shell_write,
            local_shell::local_shell_resize,
            local_shell::local_shell_close,
            local_shell::ssh_connect,
            local_shell::ssh_write,
            local_shell::ssh_resize,
            local_shell::ssh_close,
            local_shell::ssh_key_test,
            local_shell::ssh_key_install,
            local_shell::ssh_tunnel_open,
            local_shell::ssh_tunnel_close,
            local_shell::ssh_tunnel_status,
            sftp::sftp_list,
            sftp::sftp_mkdir,
            sftp::sftp_remove,
            sftp::sftp_rename,
            sftp::sftp_upload,
            sftp::sftp_download,
            sftp::sftp_cancel,
            sftp::sftp_local_list,
            sftp::sftp_local_home,
            sftp::sftp_remote_home,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Native "Tab" submenu: cycle terminal tabs from the menu bar with Ctrl+Tab /
/// Ctrl+Shift+Tab (the VS Code / browser / Termius accelerators). On macOS it
/// also owns Cmd+T and Cmd+W, which is why Close Window moves to Cmd+Shift+W.
/// We don't list every open tab here; that would mean rebuilding the menu on
/// every tab change.
fn tab_submenu<R: Runtime>(handle: &AppHandle<R>) -> tauri::Result<Submenu<R>> {
    let next = MenuItem::with_id(handle, "tab-next", "Next Tab", true, Some("Ctrl+Tab"))?;
    let prev = MenuItem::with_id(
        handle,
        "tab-prev",
        "Previous Tab",
        true,
        Some("Ctrl+Shift+Tab"),
    )?;
    if cfg!(target_os = "macos") {
        let new_local = MenuItem::with_id(
            handle,
            "tab-new-local",
            "New Local Shell",
            true,
            Some("Cmd+T"),
        )?;
        let close = MenuItem::with_id(handle, "tab-close", "Close Tab", true, Some("Cmd+W"))?;
        Submenu::with_id_and_items(
            handle,
            "tab",
            "Tab",
            true,
            &[
                &new_local,
                &close,
                &PredefinedMenuItem::separator(handle)?,
                &next,
                &prev,
            ],
        )
    } else {
        // Ctrl+T / Ctrl+W belong to the shell on Windows/Linux; the frontend
        // handles its own Ctrl+Shift chords there.
        Submenu::with_id_and_items(handle, "tab", "Tab", true, &[&next, &prev])
    }
}

#[cfg(target_os = "macos")]
fn build_menu<R: Runtime>(handle: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let name = handle.package_info().name.clone();
    let app_menu = Submenu::with_items(
        handle,
        name,
        true,
        &[
            &PredefinedMenuItem::about(handle, None, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::services(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::hide(handle, None)?,
            &PredefinedMenuItem::hide_others(handle, None)?,
            &PredefinedMenuItem::show_all(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::quit(handle, None)?,
        ],
    )?;
    // Edit items are what make Cmd+C / Cmd+V / Cmd+A work in the webview.
    let edit_menu = Submenu::with_items(
        handle,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(handle, None)?,
            &PredefinedMenuItem::redo(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::cut(handle, None)?,
            &PredefinedMenuItem::copy(handle, None)?,
            &PredefinedMenuItem::paste(handle, None)?,
            &PredefinedMenuItem::select_all(handle, None)?,
        ],
    )?;
    let view_menu = Submenu::with_items(
        handle,
        "View",
        true,
        &[&PredefinedMenuItem::fullscreen(handle, None)?],
    )?;
    let close_window = MenuItem::with_id(
        handle,
        "window-close",
        "Close Window",
        true,
        Some("Cmd+Shift+W"),
    )?;
    let window_menu = Submenu::with_items(
        handle,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(handle, None)?,
            &PredefinedMenuItem::maximize(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &close_window,
        ],
    )?;
    Menu::with_items(
        handle,
        &[
            &app_menu,
            &edit_menu,
            &view_menu,
            &tab_submenu(handle)?,
            &window_menu,
        ],
    )
}

/// Windows/Linux: the platform default menu plus the Tab submenu.
#[cfg(not(target_os = "macos"))]
fn build_menu<R: Runtime>(handle: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let menu = Menu::default(handle)?;
    menu.append(&tab_submenu(handle)?)?;
    Ok(menu)
}
