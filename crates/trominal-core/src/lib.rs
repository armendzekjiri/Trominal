//! Shared SSH / SFTP / tunnel session logic for the Trominal desktop client
//! and the `trominal-helper` CLI.
//!
//! The crate is organised by concern, not by surface:
//! - [`types`]: pure wire-protocol structs (DTOs + event payloads).
//! - [`event`]: the [`event::EventSink`] trait that lets session code emit
//!   events without knowing whether the consumer is Tauri or a WebSocket.
//! - [`pty`]: PTY session machinery (open / write / resize / close, reader
//!   thread, temp-path cleanup).
//!
//! SFTP and SSH-tunnel command construction will land here in subsequent
//! commits on phase/10-web-helper.

pub mod event;
pub mod pty;
pub mod types;

pub use event::{emit_typed, EventSink};
pub use pty::{
    cleanup_temp_paths, close_session, open_pty_session, require_session_id, resize_session,
    write_session, LocalShellError, LocalShellSession, LocalShellState, PtyCommand, PtyEvents,
    PtyGeometry, TunnelSession,
};
pub use types::*;
