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
use std::io::{Read, Write};
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
    pub resources: SessionResources,
}

/// A long-lived `ssh -L/-R/-D` child plus the resources it owns.
pub struct TunnelSession {
    pub child: ProcessChild,
    pub resources: SessionResources,
}

/// Whatever a session's child process needs while it runs (for SSH: the
/// private agent, pinned known_hosts and their directory). Released by
/// dropping, which happens when the session closes, exits or fails to
/// start.
#[derive(Default)]
pub struct SessionResources(
    // Never read: held only so it is dropped together with the session.
    #[allow(dead_code)] Option<Box<dyn Send>>,
);

impl SessionResources {
    pub fn none() -> Self {
        Self(None)
    }

    pub fn new(resource: impl Send + 'static) -> Self {
        Self(Some(Box::new(resource)))
    }
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
    pub resources: SessionResources,
}

/// Spawn a child process under a freshly opened PTY pair, register the
/// session in [`LocalShellState::sessions`], and start a reader thread
/// that streams bytes into the supplied [`EventSink`].
///
/// `resources` are owned by the session and released when it closes,
/// whether through normal exit, error, or [`close_session`]. On any
/// failure during setup they are released before the error is returned.
pub fn open_pty_session(
    sink: Arc<dyn EventSink>,
    state: Arc<LocalShellState>,
    session_id: String,
    command: CommandBuilder,
    resources: SessionResources,
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
        .map_err(|err| LocalShellError::Operation(err.to_string()))?;

    let mut child = pair
        .slave
        .spawn_command(command)
        .map_err(|err| LocalShellError::Operation(err.to_string()))?;

    let reader = match pair.master.try_clone_reader() {
        Ok(reader) => reader,
        Err(err) => {
            let _ = child.kill();
            return Err(LocalShellError::Operation(err.to_string()));
        }
    };
    let writer = match pair.master.take_writer() {
        Ok(writer) => writer,
        Err(err) => {
            let _ = child.kill();
            return Err(LocalShellError::Operation(err.to_string()));
        }
    };
    let state_for_reader = Arc::clone(&state);

    let mut sessions = match state.sessions.lock() {
        Ok(sessions) => sessions,
        Err(_) => {
            let _ = child.kill();
            return Err(LocalShellError::Locked);
        }
    };
    sessions.insert(
        id.clone(),
        LocalShellSession {
            master: pair.master,
            writer,
            child,
            resources,
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
        drop(session);
        kill_result?;
    }

    Ok(())
}

/// Kill every PTY session and tunnel and release their resources. Called
/// when the app exits so no ssh child or private agent outlives it.
pub fn close_all_sessions(state: &LocalShellState) {
    let sessions: Vec<LocalShellSession> = match state.sessions.lock() {
        Ok(mut sessions) => sessions.drain().map(|(_, session)| session).collect(),
        Err(poisoned) => poisoned
            .into_inner()
            .drain()
            .map(|(_, session)| session)
            .collect(),
    };
    for mut session in sessions {
        let _ = session.child.kill();
    }
    let tunnels: Vec<TunnelSession> = match state.tunnels.lock() {
        Ok(mut tunnels) => tunnels.drain().map(|(_, tunnel)| tunnel).collect(),
        Err(poisoned) => poisoned
            .into_inner()
            .drain()
            .map(|(_, tunnel)| tunnel)
            .collect(),
    };
    for mut tunnel in tunnels {
        let _ = tunnel.child.kill();
        let _ = tunnel.child.wait();
    }
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
        // Dropping the session releases its resources.
        sessions.remove(session_id);
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
