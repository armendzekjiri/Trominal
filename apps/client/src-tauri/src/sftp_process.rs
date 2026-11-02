//! Lifecycle of one `sftp -b -` child process: spawn, feed the batch, wait,
//! cancel. Kept free of Tauri types so it can be unit tested.

use std::io::{Read, Write};
use std::process::{Child, Command as ProcessCommand, ExitStatus, Stdio};
use std::sync::{Arc, Mutex, MutexGuard};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

/// How often the monitor polls the child for exit. Short enough that a
/// finished transfer is reported promptly, long enough to cost nothing.
const POLL_INTERVAL: Duration = Duration::from_millis(50);

/// Only the tail of each stream is kept for error messages.
const MAX_CAPTURED_BYTES: usize = 64 * 1024;

/// How long to wait for the pipes to drain once the child has exited.
const OUTPUT_GRACE: Duration = Duration::from_secs(2);

/// How a transfer ended.
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum TransferOutcome {
    /// The child exited on its own (successfully or not).
    Exited {
        success: bool,
        code: Option<i32>,
        stdout: String,
        stderr: String,
    },
    /// The transfer was cancelled; the child is gone.
    Cancelled,
    WaitError(String),
}

/// Result of a cancel request.
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum CancelResult {
    /// The child was killed and reaped before `cancel` returned.
    Cancelled,
    /// The child had already exited; its own outcome stands.
    AlreadyFinished,
}

enum Phase {
    Running,
    Exited(ExitStatus),
    Cancelled,
}

struct Inner {
    /// Owned for the whole transfer so `cancel` can always reach it.
    child: Child,
    phase: Phase,
}

/// One `sftp` child. The child stays inside the mutex until it has been
/// reaped, and whichever of "exited" or "cancelled" is recorded first under
/// that mutex decides the outcome, so a cancelled transfer is never
/// reported as completed and a completed one is never reported cancelled.
pub(crate) struct TransferProcess {
    inner: Mutex<Inner>,
    stdout: Capture,
    stderr: Capture,
}

impl TransferProcess {
    /// Spawn `command` with piped stdio, start draining stdout and stderr,
    /// and write `batch` to its stdin (then close it).
    pub(crate) fn spawn(mut command: ProcessCommand, batch: &[u8]) -> Result<Self, String> {
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        let mut child = command.spawn().map_err(|err| err.to_string())?;
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        let stdin = child.stdin.take();
        let process = Self {
            inner: Mutex::new(Inner {
                child,
                phase: Phase::Running,
            }),
            stdout: Capture::start(stdout),
            stderr: Capture::start(stderr),
        };

        if let Some(mut stdin) = stdin {
            let written = stdin.write_all(batch);
            drop(stdin);
            if let Err(err) = written {
                let _ = process.cancel();
                return Err(err.to_string());
            }
        }
        Ok(process)
    }

    /// Block until the child exits or is cancelled.
    pub(crate) fn wait_for_exit(&self) -> TransferOutcome {
        loop {
            {
                let mut inner = self.lock();
                match inner.phase {
                    Phase::Cancelled => return TransferOutcome::Cancelled,
                    Phase::Exited(status) => {
                        drop(inner);
                        return self.exited(status);
                    }
                    Phase::Running => {}
                }
                match inner.child.try_wait() {
                    Ok(Some(status)) => {
                        inner.phase = Phase::Exited(status);
                        drop(inner);
                        return self.exited(status);
                    }
                    Ok(None) => {}
                    Err(err) => {
                        // The child can't be observed any more; make sure it
                        // is gone rather than leaving it running unattended.
                        let _ = inner.child.kill();
                        let _ = inner.child.wait();
                        inner.phase = Phase::Cancelled;
                        return TransferOutcome::WaitError(err.to_string());
                    }
                }
            }
            thread::sleep(POLL_INTERVAL);
        }
    }

    /// Kill the child and wait until it has terminated. Returns
    /// `AlreadyFinished` if it exited on its own first.
    pub(crate) fn cancel(&self) -> Result<CancelResult, String> {
        let mut inner = self.lock();
        match inner.phase {
            Phase::Cancelled => return Ok(CancelResult::Cancelled),
            Phase::Exited(_) => return Ok(CancelResult::AlreadyFinished),
            Phase::Running => {}
        }
        if let Ok(Some(status)) = inner.child.try_wait() {
            inner.phase = Phase::Exited(status);
            return Ok(CancelResult::AlreadyFinished);
        }
        // kill() only fails if the child is already gone; wait() below is
        // the actual confirmation that it has terminated.
        let _ = inner.child.kill();
        inner.child.wait().map_err(|err| err.to_string())?;
        inner.phase = Phase::Cancelled;
        Ok(CancelResult::Cancelled)
    }

    fn exited(&self, status: ExitStatus) -> TransferOutcome {
        let (stdout, stderr) = self.collect_output();
        TransferOutcome::Exited {
            success: status.success(),
            code: status.code(),
            stdout,
            stderr,
        }
    }

    /// Wait (bounded) for both pipes to reach EOF and return what they
    /// carried. A grandchild that inherited a pipe can keep it open after
    /// the child exits, so this never blocks longer than `OUTPUT_GRACE`.
    fn collect_output(&self) -> (String, String) {
        let deadline = Instant::now() + OUTPUT_GRACE;
        while !(self.stdout.done() && self.stderr.done()) && Instant::now() < deadline {
            thread::sleep(Duration::from_millis(10));
        }
        (self.stdout.snapshot(), self.stderr.snapshot())
    }

    fn lock(&self) -> MutexGuard<'_, Inner> {
        self.inner
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

/// Drains one pipe on a background thread so the child never blocks on a
/// full buffer, keeping only the last `MAX_CAPTURED_BYTES` for diagnostics.
struct Capture {
    buffer: Arc<Mutex<Vec<u8>>>,
    reader: JoinHandle<()>,
}

impl Capture {
    fn start(pipe: Option<impl Read + Send + 'static>) -> Self {
        let buffer = Arc::new(Mutex::new(Vec::new()));
        let sink = Arc::clone(&buffer);
        let reader = thread::spawn(move || {
            let Some(mut pipe) = pipe else { return };
            let mut chunk = [0_u8; 8192];
            loop {
                match pipe.read(&mut chunk) {
                    Ok(0) | Err(_) => break,
                    Ok(size) => {
                        let mut kept = sink.lock().unwrap_or_else(|p| p.into_inner());
                        kept.extend_from_slice(&chunk[..size]);
                        if kept.len() > MAX_CAPTURED_BYTES * 2 {
                            let excess = kept.len() - MAX_CAPTURED_BYTES;
                            kept.drain(..excess);
                        }
                    }
                }
            }
        });
        Self { buffer, reader }
    }

    fn done(&self) -> bool {
        self.reader.is_finished()
    }

    fn snapshot(&self) -> String {
        let kept = self.buffer.lock().unwrap_or_else(|p| p.into_inner());
        let start = kept.len().saturating_sub(MAX_CAPTURED_BYTES);
        String::from_utf8_lossy(&kept[start..]).into_owned()
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::{CancelResult, TransferOutcome, TransferProcess};
    use std::process::Command;
    use std::sync::mpsc;
    use std::sync::Arc;
    use std::thread;
    use std::time::Duration;

    fn sh(script: &str) -> Command {
        let mut command = Command::new("sh");
        command.arg("-c").arg(script);
        command
    }

    fn wait_in_background(process: &Arc<TransferProcess>) -> mpsc::Receiver<TransferOutcome> {
        let (tx, rx) = mpsc::channel();
        let process = Arc::clone(process);
        thread::spawn(move || {
            let _ = tx.send(process.wait_for_exit());
        });
        rx
    }

    #[test]
    fn cancel_stops_a_running_transfer() {
        let process = Arc::new(TransferProcess::spawn(sh("sleep 30"), b"").unwrap());
        let outcome = wait_in_background(&process);
        // Let the monitor start waiting before the cancel arrives.
        thread::sleep(Duration::from_millis(200));

        assert_eq!(process.cancel().unwrap(), CancelResult::Cancelled);
        assert_eq!(
            outcome.recv_timeout(Duration::from_secs(5)),
            Ok(TransferOutcome::Cancelled),
            "the child must be terminated by the time cancel returns"
        );
    }

    #[test]
    fn cancel_after_completion_never_reports_cancelled() {
        let process = Arc::new(TransferProcess::spawn(sh("exit 0"), b"").unwrap());
        let outcome = wait_in_background(&process);
        assert!(matches!(
            outcome.recv_timeout(Duration::from_secs(5)),
            Ok(TransferOutcome::Exited { success: true, .. })
        ));

        assert_eq!(process.cancel().unwrap(), CancelResult::AlreadyFinished);
    }

    #[test]
    fn cancelled_transfer_is_never_reported_as_success() {
        // Whatever exit status the killed child leaves behind, a cancelled
        // transfer must surface as Cancelled, never as a completed one.
        let process = Arc::new(TransferProcess::spawn(sh("sleep 30; exit 0"), b"").unwrap());
        let outcome = wait_in_background(&process);
        thread::sleep(Duration::from_millis(100));
        assert_eq!(process.cancel().unwrap(), CancelResult::Cancelled);
        assert_eq!(
            outcome.recv_timeout(Duration::from_secs(5)),
            Ok(TransferOutcome::Cancelled)
        );
        // A second cancel is harmless.
        assert_eq!(process.cancel().unwrap(), CancelResult::Cancelled);
    }

    #[test]
    fn large_output_on_both_pipes_does_not_stall_the_child() {
        let process = Arc::new(
            TransferProcess::spawn(
                sh("head -c 1000000 /dev/zero; head -c 1000000 /dev/zero >&2"),
                b"",
            )
            .unwrap(),
        );
        let outcome = wait_in_background(&process);
        let result = outcome.recv_timeout(Duration::from_secs(10));
        if result.is_err() {
            let _ = process.cancel();
        }
        assert!(
            matches!(result, Ok(TransferOutcome::Exited { success: true, .. })),
            "child stalled on a full pipe"
        );
    }

    #[test]
    fn failure_reports_exit_code_and_output() {
        let process = Arc::new(
            TransferProcess::spawn(sh("cat >/dev/null; echo boom >&2; exit 3"), b"put x y\n")
                .unwrap(),
        );
        let outcome = wait_in_background(&process);
        match outcome.recv_timeout(Duration::from_secs(5)) {
            Ok(TransferOutcome::Exited {
                success: false,
                code,
                stderr,
                ..
            }) => {
                assert_eq!(code, Some(3));
                assert!(stderr.contains("boom"), "{stderr:?}");
            }
            other => panic!("unexpected outcome: {other:?}"),
        }
    }
}
