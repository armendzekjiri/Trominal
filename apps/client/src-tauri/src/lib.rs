mod local_shell;
mod secure;
mod sftp;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(std::sync::Arc::new(local_shell::LocalShellState::default()))
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
