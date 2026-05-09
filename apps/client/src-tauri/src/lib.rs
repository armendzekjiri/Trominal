mod event_sink;
mod local_shell;
mod secure;
mod sftp;

use tauri::menu::{Menu, MenuItem, Submenu};
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
            // Native "Tab" submenu so users can cycle terminal tabs from
            // the OS menu bar with Ctrl+Tab / Ctrl+Shift+Tab — same
            // accelerators VS Code, browsers, and Termius use. The clicks
            // emit Tauri events that TerminalPage listens for; we don't
            // try to keep a live list of every open tab in the menu
            // because that would mean rebuilding the menu on every tab
            // change. Next/Previous covers the common case cleanly.
            let handle = app.handle();
            let next_tab =
                MenuItem::with_id(handle, "tab-next", "Next Tab", true, Some("Ctrl+Tab"))?;
            let prev_tab = MenuItem::with_id(
                handle,
                "tab-prev",
                "Previous Tab",
                true,
                Some("Ctrl+Shift+Tab"),
            )?;
            let tab_submenu = Submenu::with_id_and_items(
                handle,
                "tab",
                "Tab",
                true,
                &[&next_tab, &prev_tab],
            )?;
            // Start from the platform-default menu (App / Edit / Window /
            // Help on macOS, sensible defaults on other platforms) so
            // standard accelerators like Cmd+Q and Cmd+C keep working,
            // then append our Tab submenu on the right.
            let menu = Menu::default(handle)?;
            menu.append(&tab_submenu)?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| match event.id().0.as_str() {
            "tab-next" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("tab://next", ());
                }
            }
            "tab-prev" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("tab://prev", ());
                }
            }
            _ => {}
        })
        .manage(std::sync::Arc::new(trominal_core::LocalShellState::default()))
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
