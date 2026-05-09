//! Shared SSH / SFTP / tunnel session logic for the Trominal desktop client
//! and the `trominal-helper` CLI. Phase 10 will hoist the session machinery
//! out of `apps/client/src-tauri/src/{local_shell,sftp}.rs` behind an
//! `EventSink` trait so the Tauri app and the helper can both drive the
//! same code without duplicating it.
//!
//! M1.1 lands the wire-protocol types so both surfaces agree on the shape
//! of every request, response, and event payload.

pub mod types;

pub use types::*;
