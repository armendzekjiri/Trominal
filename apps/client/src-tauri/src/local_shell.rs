use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
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

struct PtyGeometry {
    cols: u16,
    rows: u16,
}

struct PtyEvents {
    data: &'static str,
    closed: &'static str,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshConnectRequest {
    session_id: String,
    host: String,
    port: u16,
    username: String,
    cols: u16,
    rows: u16,
}

#[tauri::command]
pub fn local_shell_open(
    app: AppHandle,
    state: State<'_, Arc<LocalShellState>>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<String, String> {
    open_pty_session(
        app,
        state,
        session_id,
        shell_command(),
        PtyGeometry { cols, rows },
        PtyEvents {
            data: "local-shell://data",
            closed: "local-shell://closed",
        },
    )
}

#[tauri::command]
pub fn ssh_connect(
    app: AppHandle,
    state: State<'_, Arc<LocalShellState>>,
    request: SshConnectRequest,
) -> Result<String, String> {
    open_pty_session(
        app,
        state,
        request.session_id,
        ssh_command(request.host, request.port, request.username)?,
        PtyGeometry {
            cols: request.cols,
            rows: request.rows,
        },
        PtyEvents {
            data: "ssh://data",
            closed: "ssh://closed",
        },
    )
}

fn open_pty_session(
    app: AppHandle,
    state: State<'_, Arc<LocalShellState>>,
    session_id: String,
    command: CommandBuilder,
    geometry: PtyGeometry,
    events: PtyEvents,
) -> Result<String, String> {
    let cols = geometry.cols.max(1);
    let rows = geometry.rows.max(1);
    let id = require_session_id(session_id)?;
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
        .spawn_command(command)
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
    let state_for_reader = Arc::clone(state.inner());

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

    spawn_reader(app, state_for_reader, id.clone(), reader, events);

    Ok(id)
}

#[tauri::command]
pub fn local_shell_write(
    state: State<'_, Arc<LocalShellState>>,
    session_id: String,
    data: Vec<u8>,
) -> Result<(), String> {
    write_session(state, session_id, data)
}

#[tauri::command]
pub fn ssh_write(
    state: State<'_, Arc<LocalShellState>>,
    session_id: String,
    data: Vec<u8>,
) -> Result<(), String> {
    write_session(state, session_id, data)
}

fn write_session(
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
    resize_session(state, session_id, cols, rows)
}

#[tauri::command]
pub fn ssh_resize(
    state: State<'_, Arc<LocalShellState>>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    resize_session(state, session_id, cols, rows)
}

fn resize_session(
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
    close_session(state, session_id)
}

#[tauri::command]
pub fn ssh_close(state: State<'_, Arc<LocalShellState>>, session_id: String) -> Result<(), String> {
    close_session(state, session_id)
}

fn close_session(state: State<'_, Arc<LocalShellState>>, session_id: String) -> Result<(), String> {
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

fn spawn_reader(
    app: AppHandle,
    state: Arc<LocalShellState>,
    session_id: String,
    mut reader: Box<dyn Read + Send>,
    events: PtyEvents,
) {
    std::thread::spawn(move || {
        let mut buffer = [0_u8; 8192];

        loop {
            match reader.read(&mut buffer) {
                Ok(0) => {
                    emit_closed(&app, events.closed, &session_id, "closed".to_string());
                    remove_session(&state, &session_id);
                    break;
                }
                Ok(size) => {
                    let _ = app.emit(
                        events.data,
                        LocalShellData {
                            session_id: session_id.clone(),
                            data: buffer[..size].to_vec(),
                        },
                    );
                }
                Err(err) => {
                    emit_closed(&app, events.closed, &session_id, err.to_string());
                    remove_session(&state, &session_id);
                    break;
                }
            }
        }
    });
}

fn emit_closed(app: &AppHandle, event: &'static str, session_id: &str, reason: String) {
    let _ = app.emit(
        event,
        LocalShellClosed {
            session_id: session_id.to_string(),
            reason,
        },
    );
}

fn remove_session(state: &LocalShellState, session_id: &str) {
    if let Ok(mut sessions) = state.sessions.lock() {
        sessions.remove(session_id);
    }
}

fn require_session_id(session_id: String) -> Result<String, String> {
    if session_id.is_empty() {
        return Err(LocalShellError::Operation("session id is required".to_string()).to_string());
    }

    Ok(session_id)
}

fn shell_command() -> CommandBuilder {
    let shell = default_shell();
    let mut command = CommandBuilder::new(shell);
    command.env("TERM", "xterm-256color");
    command
}

fn ssh_command(host: String, port: u16, username: String) -> Result<CommandBuilder, String> {
    let host = host.trim();
    let username = username.trim();

    if host.is_empty() {
        return Err(LocalShellError::Operation("host is required".to_string()).to_string());
    }

    let destination = if username.is_empty() {
        host.to_string()
    } else {
        format!("{username}@{host}")
    };
    let port = port.max(1).to_string();

    let mut command = CommandBuilder::new("ssh");
    command.arg("-tt");
    command.arg("-p");
    command.arg(port);
    command.arg("-o");
    command.arg("BatchMode=no");
    command.arg("-o");
    command.arg("PreferredAuthentications=publickey,password,keyboard-interactive");
    command.arg(destination);
    command.env("TERM", "xterm-256color");

    Ok(command)
}

#[cfg(windows)]
fn default_shell() -> String {
    env::var("COMSPEC").unwrap_or_else(|_| "powershell.exe".to_string())
}

#[cfg(not(windows))]
fn default_shell() -> String {
    env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
}
