//! Event-emission abstraction shared by the desktop client (Tauri
//! `AppHandle::emit`) and the helper CLI (WebSocket message send).
//!
//! Session-management code in [`crate::pty`] holds an [`EventSink`] and
//! does not know which surface is consuming the events. Emitters drop
//! errors on purpose — the SSH session must keep running even if the UI
//! listener has disconnected, and there is nothing useful the session
//! thread could do with the failure besides log it.

use serde::Serialize;

/// Sink for events that originate inside a session thread.
///
/// Implementations must be safe to share across threads; sessions hold
/// `Arc<dyn EventSink>` and clone it into spawned readers.
pub trait EventSink: Send + Sync {
    /// Emit `payload` (already serialized to a JSON value) to subscribers
    /// of `topic`. Errors are intentionally swallowed.
    fn emit(&self, topic: &str, payload: serde_json::Value);
}

/// Convenience: serialize a typed payload and forward it to the sink.
/// Returns silently on serialization failure — same drop-on-error policy
/// as [`EventSink::emit`].
pub fn emit_typed<T: Serialize>(sink: &dyn EventSink, topic: &str, payload: &T) {
    if let Ok(value) = serde_json::to_value(payload) {
        sink.emit(topic, value);
    }
}
