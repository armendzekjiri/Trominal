mod secure;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            secure::secure_set,
            secure::secure_get,
            secure::secure_delete,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
