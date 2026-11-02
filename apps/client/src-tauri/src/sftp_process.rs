//! Lifecycle of one `sftp -b -` child process: spawn, feed the batch, wait,
//! cancel. Kept free of Tauri types so it can be unit tested.

use std::io::{Read, Write};
use std::process::{Child, Command as ProcessCommand, Stdio};
use std::sync::Mutex;

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
    Cancelled,
    AlreadyFinished,
}

pub(crate) struct TransferProcess {
    child: Mutex<Option<Child>>,
}

impl TransferProcess {
    /// Spawn `command` with piped stdio and write `batch` to its stdin.
    pub(crate) fn spawn(mut command: ProcessCommand, batch: &[u8]) -> Result<Self, String> {
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        let mut child = command.spawn().map_err(|err| err.to_string())?;
        if let Some(mut stdin) = child.stdin.take() {
            if let Err(err) = stdin.write_all(batch) {
                let _ = child.kill();
                let _ = child.wait();
                return Err(err.to_string());
            }
        }
        Ok(Self {
            child: Mutex::new(Some(child)),
        })
    }

    /// Block until the child exits.
    pub(crate) fn wait_for_exit(&self) -> TransferOutcome {
        let taken = self.child.lock().ok().and_then(|mut guard| guard.take());
        let Some(mut child) = taken else {
            return TransferOutcome::Cancelled;
        };
        let result = child.wait();
        let mut stderr = String::new();
        if let Some(mut pipe) = child.stderr.take() {
            let _ = pipe.read_to_string(&mut stderr);
        }
        let mut stdout = String::new();
        if let Some(mut pipe) = child.stdout.take() {
            let _ = pipe.read_to_string(&mut stdout);
        }
        match result {
            Ok(status) => TransferOutcome::Exited {
                success: status.success(),
                code: status.code(),
                stdout,
                stderr,
            },
            Err(err) => TransferOutcome::WaitError(err.to_string()),
        }
    }

    /// Stop the transfer.
    pub(crate) fn cancel(&self) -> Result<CancelResult, String> {
        if let Ok(mut guard) = self.child.lock() {
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
        Ok(CancelResult::Cancelled)
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
