// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // When `ssh-add` runs us as its askpass program, answer and exit
    // before any GUI starts.
    if let Some(code) = trominal_client_lib::askpass_mode() {
        std::process::exit(code);
    }
    trominal_client_lib::run()
}
