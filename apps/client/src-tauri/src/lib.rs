mod local_shell;
mod secure;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(std::sync::Arc::new(local_shell::LocalShellState::default()))
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
