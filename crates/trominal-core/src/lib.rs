//! Shared SSH / SFTP / tunnel session logic for the Trominal desktop client
//! and the `trominal-helper` CLI. Phase 10 will hoist
//! `apps/client/src-tauri/src/{local_shell,sftp}.rs` into this crate behind
//! an `EventSink` trait so the Tauri app and the helper can both drive the
//! same session machinery without duplicating it.
