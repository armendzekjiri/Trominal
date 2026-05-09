//! PTY session machinery shared by the desktop client and the helper CLI.
//!
//! Both surfaces shell out to OpenSSH via `portable-pty` and stream bytes
//! between the master fd and an event listener (Tauri emit, WebSocket).
//! Holding a single implementation here means a security-sensitive bug fix
//! ships in one place.

use crate::event::{emit_typed, EventSink};
use crate::types::{LocalShellClosed, LocalShellData};
use portable_pty::{native_pty_system, Child as PtyChild, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::Child as ProcessChild;
use std::sync::{Arc, Mutex};
use std::thread;
use thiserror::Error;

/// Per-process state that owns every live PTY session and SSH tunnel.
/// The Tauri app and the helper each construct a single [`LocalShellState`]
/// at startup and `Arc`-clone it into the relevant command paths.
#[derive(Default)]
pub struct LocalShellState {
    pub sessions: Mutex<HashMap<String, LocalShellSession>>,
    pub tunnels: Mutex<HashMap<String, TunnelSession>>,
}

/// One live PTY-backed session (a local shell or an `ssh` child).
pub struct LocalShellSession {
    pub master: Box<dyn MasterPty + Send>,
    pub writer: Box<dyn Write + Send>,
    pub child: Box<dyn PtyChild + Send + Sync>,
    pub temp_paths: Vec<PathBuf>,
}

/// A long-lived `ssh -L/-R/-D` child plus any temp identity files it owns.
pub struct TunnelSession {
    pub child: ProcessChild,
    pub temp_paths: Vec<PathBuf>,
}

#[derive(Debug, Error)]
pub enum LocalShellError {
    #[error("local shell session was not found")]
    MissingSession,
    #[error("local shell operation failed: {0}")]
    Operation(String),
    #[error("local shell state is unavailable")]
    Locked,
}

pub struct PtyGeometry {
    pub cols: u16,
    pub rows: u16,
}

/// The two event topics a PTY session emits on. The names are the same
/// strings the existing frontend already listens for, so this stays
/// `&'static str` rather than an enum.
pub struct PtyEvents {
    pub data: &'static str,
    pub closed: &'static str,
}

pub struct PtyCommand {
    pub command: CommandBuilder,
    pub temp_paths: Vec<PathBuf>,
}

/// Spawn a child process under a freshly opened PTY pair, register the
/// session in [`LocalShellState::sessions`], and start a reader thread
/// that streams bytes into the supplied [`EventSink`].
///
/// `temp_paths` are owned by the session — they will be removed when the
/// session closes, whether through normal exit, error, or
/// [`close_session`]. On any failure during setup the temp paths are
/// cleaned up before the error is returned.
pub fn open_pty_session(
    sink: Arc<dyn EventSink>,
    state: Arc<LocalShellState>,
    session_id: String,
    command: CommandBuilder,
    temp_paths: Vec<PathBuf>,
    geometry: PtyGeometry,
    events: PtyEvents,
) -> Result<String, LocalShellError> {
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
        .map_err(|err| {
            cleanup_temp_paths(&temp_paths);
            LocalShellError::Operation(err.to_string())
        })?;

    let mut child = pair.slave.spawn_command(command).map_err(|err| {
        cleanup_temp_paths(&temp_paths);
        LocalShellError::Operation(err.to_string())
    })?;

    let reader = match pair.master.try_clone_reader() {
        Ok(reader) => reader,
        Err(err) => {
            let _ = child.kill();
            cleanup_temp_paths(&temp_paths);
            return Err(LocalShellError::Operation(err.to_string()));
        }
    };
    let writer = match pair.master.take_writer() {
        Ok(writer) => writer,
        Err(err) => {
            let _ = child.kill();
            cleanup_temp_paths(&temp_paths);
            return Err(LocalShellError::Operation(err.to_string()));
        }
    };
    let state_for_reader = Arc::clone(&state);

    let mut sessions = match state.sessions.lock() {
        Ok(sessions) => sessions,
        Err(_) => {
            let _ = child.kill();
            cleanup_temp_paths(&temp_paths);
            return Err(LocalShellError::Locked);
        }
    };
    sessions.insert(
        id.clone(),
        LocalShellSession {
            master: pair.master,
            writer,
            child,
            temp_paths,
        },
    );
    drop(sessions);

    spawn_reader(sink, state_for_reader, id.clone(), reader, events);

    Ok(id)
}

pub fn write_session(
    state: &LocalShellState,
    session_id: &str,
    data: &[u8],
) -> Result<(), LocalShellError> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| LocalShellError::Locked)?;
    let session = sessions
        .get_mut(session_id)
        .ok_or(LocalShellError::MissingSession)?;
    session
        .writer
        .write_all(data)
        .map_err(|err| LocalShellError::Operation(err.to_string()))
}

pub fn resize_session(
    state: &LocalShellState,
    session_id: &str,
    cols: u16,
    rows: u16,
) -> Result<(), LocalShellError> {
    let sessions = state
        .sessions
        .lock()
        .map_err(|_| LocalShellError::Locked)?;
    let session = sessions
        .get(session_id)
        .ok_or(LocalShellError::MissingSession)?;
    session
        .master
        .resize(PtySize {
            rows: rows.max(1),
            cols: cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| LocalShellError::Operation(err.to_string()))
}

pub fn close_session(state: &LocalShellState, session_id: &str) -> Result<(), LocalShellError> {
    let session = state
        .sessions
        .lock()
        .map_err(|_| LocalShellError::Locked)?
        .remove(session_id);

    if let Some(mut session) = session {
        let kill_result = session
            .child
            .kill()
            .map_err(|err| LocalShellError::Operation(err.to_string()));
        cleanup_temp_paths(&session.temp_paths);
        kill_result?;
    }

    Ok(())
}

fn spawn_reader(
    sink: Arc<dyn EventSink>,
    state: Arc<LocalShellState>,
    session_id: String,
    mut reader: Box<dyn Read + Send>,
    events: PtyEvents,
) {
    thread::spawn(move || {
        let mut buffer = [0_u8; 8192];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => {
                    emit_closed(sink.as_ref(), events.closed, &session_id, "closed".to_string());
                    remove_session(&state, &session_id);
                    break;
                }
                Ok(size) => {
                    emit_typed(
                        sink.as_ref(),
                        events.data,
                        &LocalShellData {
                            session_id: session_id.clone(),
                            data: buffer[..size].to_vec(),
                        },
                    );
                }
                Err(err) => {
                    emit_closed(sink.as_ref(), events.closed, &session_id, err.to_string());
                    remove_session(&state, &session_id);
                    break;
                }
            }
        }
    });
}

fn emit_closed(sink: &dyn EventSink, topic: &str, session_id: &str, reason: String) {
    emit_typed(
        sink,
        topic,
        &LocalShellClosed {
            session_id: session_id.to_string(),
            reason,
        },
    );
}

fn remove_session(state: &LocalShellState, session_id: &str) {
    if let Ok(mut sessions) = state.sessions.lock() {
        if let Some(session) = sessions.remove(session_id) {
            cleanup_temp_paths(&session.temp_paths);
        }
    }
}

/// Best-effort removal of any temp identity / config files the caller
/// owned. Errors are intentionally ignored — losing the file path means
/// it was already removed or the user can clean `/tmp` themselves.
pub fn cleanup_temp_paths(paths: &[PathBuf]) {
    for path in paths {
        let _ = fs::remove_file(path);
    }
}

pub fn require_session_id(session_id: String) -> Result<String, LocalShellError> {
    if session_id.is_empty() {
        return Err(LocalShellError::Operation(
            "session id is required".to_string(),
        ));
    }
    Ok(session_id)
}
