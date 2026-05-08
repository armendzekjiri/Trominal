use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::env;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};
use thiserror::Error;

#[derive(Default)]
pub struct LocalShellState {
    sessions: Mutex<HashMap<String, LocalShellSession>>,
}

struct LocalShellSession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
}

#[derive(Debug, Error)]
enum LocalShellError {
    #[error("local shell session was not found")]
    MissingSession,
    #[error("local shell operation failed: {0}")]
    Operation(String),
    #[error("local shell state is unavailable")]
    Locked,
}

#[derive(Clone, Serialize)]
struct LocalShellData {
    session_id: String,
    data: Vec<u8>,
}

#[derive(Clone, Serialize)]
struct LocalShellClosed {
    session_id: String,
    reason: String,
}

#[tauri::command]
pub fn local_shell_open(
    app: AppHandle,
    state: State<'_, Arc<LocalShellState>>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<String, String> {
    let cols = cols.max(1);
    let rows = rows.max(1);
    let id = if session_id.is_empty() {
        return Err(LocalShellError::Operation("session id is required".to_string()).to_string());
    } else {
        session_id
    };
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| LocalShellError::Operation(err.to_string()))
        .map_err(|err| err.to_string())?;

    let child = pair
        .slave
        .spawn_command(shell_command())
        .map_err(|err| LocalShellError::Operation(err.to_string()))
        .map_err(|err| err.to_string())?;
    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|err| LocalShellError::Operation(err.to_string()))
        .map_err(|err| err.to_string())?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|err| LocalShellError::Operation(err.to_string()))
        .map_err(|err| err.to_string())?;

    state
        .sessions
        .lock()
        .map_err(|_| LocalShellError::Locked.to_string())?
        .insert(
            id.clone(),
            LocalShellSession {
                master: pair.master,
                writer,
                child,
            },
        );

    spawn_reader(app, id.clone(), reader);

    Ok(id)
}

#[tauri::command]
pub fn local_shell_write(
    state: State<'_, Arc<LocalShellState>>,
    session_id: String,
    data: Vec<u8>,
) -> Result<(), String> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| LocalShellError::Locked.to_string())?;
    let session = sessions
        .get_mut(&session_id)
        .ok_or(LocalShellError::MissingSession)
        .map_err(|err| err.to_string())?;

    session
        .writer
        .write_all(&data)
        .map_err(|err| LocalShellError::Operation(err.to_string()).to_string())
}

#[tauri::command]
pub fn local_shell_resize(
    state: State<'_, Arc<LocalShellState>>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let sessions = state
        .sessions
        .lock()
        .map_err(|_| LocalShellError::Locked.to_string())?;
    let session = sessions
        .get(&session_id)
        .ok_or(LocalShellError::MissingSession)
        .map_err(|err| err.to_string())?;

    session
        .master
        .resize(PtySize {
            rows: rows.max(1),
            cols: cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| LocalShellError::Operation(err.to_string()))
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn local_shell_close(
    state: State<'_, Arc<LocalShellState>>,
    session_id: String,
) -> Result<(), String> {
    let session = state
        .sessions
        .lock()
        .map_err(|_| LocalShellError::Locked.to_string())?
        .remove(&session_id);

    if let Some(mut session) = session {
        session
            .child
            .kill()
            .map_err(|err| LocalShellError::Operation(err.to_string()))
            .map_err(|err| err.to_string())?;
    }

    Ok(())
}

fn spawn_reader(app: AppHandle, session_id: String, mut reader: Box<dyn Read + Send>) {
    std::thread::spawn(move || {
        let mut buffer = [0_u8; 8192];

        loop {
            match reader.read(&mut buffer) {
                Ok(0) => {
                    let _ = app.emit(
                        "local-shell://closed",
                        LocalShellClosed {
                            session_id,
                            reason: "closed".to_string(),
                        },
                    );
                    break;
                }
                Ok(size) => {
                    let _ = app.emit(
                        "local-shell://data",
                        LocalShellData {
                            session_id: session_id.clone(),
                            data: buffer[..size].to_vec(),
                        },
                    );
                }
                Err(err) => {
                    let _ = app.emit(
                        "local-shell://closed",
                        LocalShellClosed {
                            session_id,
                            reason: err.to_string(),
                        },
                    );
                    break;
                }
            }
        }
    });
}

fn shell_command() -> CommandBuilder {
    let shell = default_shell();
    let mut command = CommandBuilder::new(shell);
    command.env("TERM", "xterm-256color");
    command
}

#[cfg(windows)]
fn default_shell() -> String {
    env::var("COMSPEC").unwrap_or_else(|_| "powershell.exe".to_string())
}

#[cfg(not(windows))]
fn default_shell() -> String {
    env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
}
