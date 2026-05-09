mod event_sink;
mod local_shell;
mod secure;
mod sftp;

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
