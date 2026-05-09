//! Tauri-side adapter that satisfies [`trominal_core::EventSink`] by
//! forwarding to `AppHandle::emit`.

use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use trominal_core::EventSink;

pub struct TauriEventSink {
    app: AppHandle,
}

impl TauriEventSink {
    pub fn new(app: AppHandle) -> Arc<dyn EventSink> {
        Arc::new(Self { app })
    }
}

impl EventSink for TauriEventSink {
    fn emit(&self, topic: &str, payload: serde_json::Value) {
        // Match the existing behaviour: drop emit failures so a stalled
        // listener never tears down the session thread.
        let _ = self.app.emit(topic, payload);
    }
}
