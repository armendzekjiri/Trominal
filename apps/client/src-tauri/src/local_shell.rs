//! Tauri command surface for local-shell, SSH-over-system-ssh, and SSH
//! tunnel sessions. After Phase 10 M1.2 the PTY session machinery and
//! shared state live in [`trominal_core`]; this module now hosts:
//!
//! - the `#[tauri::command]` glue that the existing frontend already speaks,
//! - SSH-specific command construction (RSA compat options),
//! - SSH tunnel orchestration via `std::process::Command`,
//! - SSH key auth probe + authorized-key install helpers,
//! - the host-key scan used for first-use fingerprint approval.
//!
//! Every SSH process goes through [`PreparedSsh`]: the vault key is loaded
//! into a private agent (never written to disk on Unix) and the host must
//! match a pin the user approved (`StrictHostKeyChecking=yes` against a
//! private known_hosts). See `trominal_core::ssh_identity` and
//! `trominal_core::host_keys`.

use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::env;
use std::io::{Read, Write};
use std::process::{Child as ProcessChild, Command as ProcessCommand, Stdio};
use std::sync::mpsc;
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, State};
use trominal_core::host_keys::{
    check_presented_keys, is_host_key_failure, parse_pins, scan_host_keys, HostKey, HostKeyCheck,
    HostKeyPin, HostKeyProblem, HostKeyProblemKind,
};
use trominal_core::ssh_identity::LoadOptions;
use trominal_core::ssh_session::{ssh_destination, PreparedSsh, SshKeyMaterial};
use trominal_core::{
    close_session, open_pty_session, require_session_id, resize_session, write_session,
    LocalShellError, LocalShellState, PtyCommand, PtyEvents, PtyGeometry, SecretBytes,
    SessionResources, SshConnectRequest, SshHostKeyScanRequest, SshHostKeyScanResponse,
    SshKeyInstallRequest, SshKeyInstallResponse, SshKeyTestRequest, SshKeyTestResponse,
    SshTunnelOpenRequest, SshTunnelOpenResponse, SshTunnelSpec, SshTunnelStatusResponse,
    TunnelSession,
};

use crate::event_sink::TauriEventSink;

#[tauri::command]
pub fn local_shell_open(
    app: AppHandle,
    state: State<'_, Arc<LocalShellState>>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<String, String> {
    open_pty_session(
        TauriEventSink::new(app),
        Arc::clone(state.inner()),
        session_id,
        shell_command(),
        SessionResources::none(),
        PtyGeometry { cols, rows },
        PtyEvents {
            data: "local-shell://data",
            closed: "local-shell://closed",
        },
    )
    .map_err(|err| err.to_string())
}

/// Fetch a server's host keys for first-use approval. Runs off the main
/// thread because `ssh-keyscan` may wait for its timeout.
#[tauri::command]
pub async fn ssh_host_key_scan(
    request: SshHostKeyScanRequest,
) -> Result<SshHostKeyScanResponse, String> {
    tauri::async_runtime::spawn_blocking(move || {
        scan_host_keys(&request.host, request.port).map(|keys| SshHostKeyScanResponse { keys })
    })
    .await
    .map_err(|err| LocalShellError::Operation(err.to_string()).to_string())?
}

/// Open an interactive SSH session. Async because the host-key pre-check
/// and agent setup can take a moment.
#[tauri::command]
pub async fn ssh_connect(
    app: AppHandle,
    state: State<'_, Arc<LocalShellState>>,
    request: SshConnectRequest,
) -> Result<String, String> {
    let state = Arc::clone(state.inner());
    tauri::async_runtime::spawn_blocking(move || connect_ssh(app, state, request))
        .await
        .map_err(|err| LocalShellError::Operation(err.to_string()).to_string())?
}

fn connect_ssh(
    app: AppHandle,
    state: Arc<LocalShellState>,
    request: SshConnectRequest,
) -> Result<String, String> {
    let session_id =
        require_session_id(request.session_id.clone()).map_err(|err| err.to_string())?;
    verify_host_before_connect(&request.host, request.port.max(1), &request.host_keys)?;
    let pty_command = ssh_command(&request)?;

    open_pty_session(
        TauriEventSink::new(app),
        state,
        session_id,
        pty_command.command,
        pty_command.resources,
        PtyGeometry {
            cols: request.cols,
            rows: request.rows,
        },
        PtyEvents {
            data: "ssh://data",
            closed: "ssh://closed",
        },
    )
    .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn ssh_key_test(request: SshKeyTestRequest) -> Result<SshKeyTestResponse, String> {
    let works = test_private_key_auth(&request)?;
    Ok(SshKeyTestResponse { works })
}

#[tauri::command]
pub fn ssh_key_install(request: SshKeyInstallRequest) -> Result<SshKeyInstallResponse, String> {
    install_public_key_auth(&request)
}

#[tauri::command]
pub fn ssh_tunnel_open(
    state: State<'_, Arc<LocalShellState>>,
    request: SshTunnelOpenRequest,
) -> Result<SshTunnelOpenResponse, String> {
    let session_id =
        require_session_id(request.session_id.clone()).map_err(|err| err.to_string())?;
    let tunnel = open_ssh_tunnel(&request)?;
    let mut tunnels = state
        .tunnels
        .lock()
        .map_err(|_| LocalShellError::Locked.to_string())?;
    if let Some(mut previous) = tunnels.remove(&session_id) {
        let _ = previous.child.kill();
        let _ = previous.child.wait();
    }
    tunnels.insert(session_id.clone(), tunnel);

    Ok(SshTunnelOpenResponse { session_id })
}

#[tauri::command]
pub fn ssh_tunnel_close(
    state: State<'_, Arc<LocalShellState>>,
    session_id: String,
) -> Result<(), String> {
    let session_id = require_session_id(session_id).map_err(|err| err.to_string())?;
    let session = state
        .tunnels
        .lock()
        .map_err(|_| LocalShellError::Locked.to_string())?
        .remove(&session_id);

    if let Some(mut session) = session {
        if session
            .child
            .try_wait()
            .map_err(|err| LocalShellError::Operation(err.to_string()).to_string())?
            .is_none()
        {
            let _ = session.child.kill();
            let _ = session.child.wait();
        }
        // Dropping the session unloads the key and removes its files.
    }

    Ok(())
}

#[tauri::command]
pub fn ssh_tunnel_status(
    state: State<'_, Arc<LocalShellState>>,
    session_id: String,
) -> Result<SshTunnelStatusResponse, String> {
    let session_id = require_session_id(session_id).map_err(|err| err.to_string())?;
    let mut tunnels = state
        .tunnels
        .lock()
        .map_err(|_| LocalShellError::Locked.to_string())?;
    let Some(session) = tunnels.get_mut(&session_id) else {
        return Ok(SshTunnelStatusResponse { running: false });
    };
    let exited = session
        .child
        .try_wait()
        .map_err(|err| LocalShellError::Operation(err.to_string()).to_string())?
        .is_some();
    if !exited {
        return Ok(SshTunnelStatusResponse { running: true });
    }

    tunnels.remove(&session_id);
    Ok(SshTunnelStatusResponse { running: false })
}

#[tauri::command]
pub fn local_shell_write(
    state: State<'_, Arc<LocalShellState>>,
    session_id: String,
    data: Vec<u8>,
) -> Result<(), String> {
    write_session(state.inner(), &session_id, &data).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn ssh_write(
    state: State<'_, Arc<LocalShellState>>,
    session_id: String,
    data: Vec<u8>,
) -> Result<(), String> {
    write_session(state.inner(), &session_id, &data).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn local_shell_resize(
    state: State<'_, Arc<LocalShellState>>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    resize_session(state.inner(), &session_id, cols, rows).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn ssh_resize(
    state: State<'_, Arc<LocalShellState>>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    resize_session(state.inner(), &session_id, cols, rows).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn local_shell_close(
    state: State<'_, Arc<LocalShellState>>,
    session_id: String,
) -> Result<(), String> {
    close_session(state.inner(), &session_id).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn ssh_close(state: State<'_, Arc<LocalShellState>>, session_id: String) -> Result<(), String> {
    close_session(state.inner(), &session_id).map_err(|err| err.to_string())
}

fn shell_command() -> CommandBuilder {
    let shell = default_shell();
    let mut command = CommandBuilder::new(shell);
    command.env("TERM", "xterm-256color");
    command
}

// ---------- Shared SSH policy glue ----------

/// How the vault key reaches `ssh-add`: our own binary answers askpass.
pub(crate) fn load_options() -> LoadOptions {
    LoadOptions {
        askpass_program: env::current_exe().ok(),
        tools_dir: None,
    }
}

pub(crate) fn key_material<'a>(
    private_key: Option<&'a SecretBytes>,
    passphrase: Option<&'a SecretBytes>,
) -> Option<SshKeyMaterial<'a>> {
    private_key
        .filter(|key| !key.is_empty())
        .map(|private_key| SshKeyMaterial {
            private_key,
            passphrase,
        })
}

/// Before an interactive session (whose output goes straight to the
/// terminal), compare the server's current keys with the pins so a change
/// is reported as a structured error instead of a wall of ssh text. `ssh`
/// enforces the pins either way; if the scan itself fails we let `ssh`
/// decide.
fn verify_host_before_connect(host: &str, port: u16, pins: &[HostKeyPin]) -> Result<(), String> {
    let pins = parse_pins(pins)?;
    if pins.is_empty() {
        return Err(unknown_host_error(host, port));
    }
    match scan_host_keys(host, port) {
        Ok(presented) => match check_presented_keys(host.trim(), port, &pins, &presented) {
            HostKeyCheck::Trusted => Ok(()),
            HostKeyCheck::Problem(problem) => Err(problem.to_error_string()),
        },
        Err(_) => Ok(()),
    }
}

fn unknown_host_error(host: &str, port: u16) -> String {
    HostKeyProblem {
        kind: HostKeyProblemKind::Unknown,
        host: host.trim().to_string(),
        port,
        expected: Vec::new(),
        presented: scan_host_keys(host, port).unwrap_or_default(),
    }
    .to_error_string()
}

/// Turn an ssh/sftp failure caused by host-key checking into the
/// structured error (old vs new fingerprints). `None` for other failures.
pub(crate) fn host_key_failure_error(
    host: &str,
    port: u16,
    pins: &[HostKey],
    output: &str,
) -> Option<String> {
    if !is_host_key_failure(output) {
        return None;
    }
    let presented = scan_host_keys(host, port).unwrap_or_default();
    Some(
        match check_presented_keys(host.trim(), port, pins, &presented) {
            HostKeyCheck::Problem(problem) => problem.to_error_string(),
            HostKeyCheck::Trusted => LocalShellError::Operation(
                "host key verification failed: the server did not offer an approved key type"
                    .to_string(),
            )
            .to_string(),
        },
    )
}

fn ssh_command(request: &SshConnectRequest) -> Result<PtyCommand, String> {
    let port = request.port.max(1);
    let prepared = PreparedSsh::prepare(
        &request.host,
        port,
        &request.host_keys,
        key_material(
            request.private_key_pem.as_ref(),
            request.passphrase.as_ref(),
        ),
        &load_options(),
    )?;
    let command = terminal_ssh_command(request, &prepared)?;
    Ok(PtyCommand {
        command,
        resources: SessionResources::new(prepared),
    })
}

fn terminal_ssh_command(
    request: &SshConnectRequest,
    prepared: &PreparedSsh,
) -> Result<CommandBuilder, String> {
    let destination = ssh_destination(&request.host, &request.username)?;
    let mut command = CommandBuilder::new("ssh");
    for arg in prepared.ssh_options() {
        command.arg(arg);
    }
    command.arg("-tt");
    command.arg("-p");
    command.arg(request.port.max(1).to_string());
    command.arg("-o");
    command.arg("BatchMode=no");
    command.arg("-o");
    command.arg("PreferredAuthentications=publickey,password,keyboard-interactive");
    if prepared.rsa_key() {
        rsa_key_compat_options(&mut command);
    }
    command.arg(destination);
    command.env("TERM", "xterm-256color");
    Ok(command)
}

fn open_ssh_tunnel(request: &SshTunnelOpenRequest) -> Result<TunnelSession, String> {
    if request.private_key_pem.is_empty() {
        return Err(
            LocalShellError::Operation("attached SSH identity is required".to_string()).to_string(),
        );
    }
    let port = request.port.max(1);
    let prepared = PreparedSsh::prepare(
        &request.host,
        port,
        &request.host_keys,
        key_material(Some(&request.private_key_pem), request.passphrase.as_ref()),
        &load_options(),
    )?;
    let mut command = tunnel_command(request, &prepared)?;
    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|err| LocalShellError::Operation(err.to_string()).to_string())?;
    thread::sleep(Duration::from_millis(500));
    if let Some(status) = child
        .try_wait()
        .map_err(|err| LocalShellError::Operation(err.to_string()).to_string())?
    {
        let stderr = read_child_stderr(&mut child);
        if let Some(err) = host_key_failure_error(&request.host, port, prepared.pins(), &stderr) {
            return Err(err);
        }
        return if status.success() {
            Err(LocalShellError::Operation("SSH tunnel exited early".to_string()).to_string())
        } else {
            Err(LocalShellError::Operation(user_safe_ssh_error(&stderr, &[])).to_string())
        };
    }

    drain_child_stderr(child.stderr.take());
    Ok(TunnelSession {
        child,
        resources: SessionResources::new(prepared),
    })
}

fn tunnel_command(
    request: &SshTunnelOpenRequest,
    prepared: &PreparedSsh,
) -> Result<ProcessCommand, String> {
    let forward_args = tunnel_forward_args(&request.tunnel)?;
    let destination = ssh_destination(&request.host, &request.username)?;
    let mut command = ProcessCommand::new("ssh");
    command
        .args(prepared.ssh_options())
        .arg("-N")
        .arg("-T")
        .arg("-o")
        .arg("ExitOnForwardFailure=yes")
        .arg("-o")
        .arg("BatchMode=yes")
        .arg("-o")
        .arg("PreferredAuthentications=publickey")
        .arg("-o")
        .arg("PasswordAuthentication=no")
        .arg("-o")
        .arg("KbdInteractiveAuthentication=no")
        .arg("-o")
        .arg("ServerAliveInterval=30")
        .arg("-o")
        .arg("ServerAliveCountMax=3")
        .arg("-p")
        .arg(request.port.max(1).to_string());
    if prepared.rsa_key() {
        rsa_key_compat_process_options(&mut command);
    }
    command.args(forward_args).arg(destination);
    Ok(command)
}

fn test_private_key_auth(request: &SshKeyTestRequest) -> Result<bool, String> {
    let port = request.port.max(1);
    let prepared = PreparedSsh::prepare(
        &request.host,
        port,
        &request.host_keys,
        key_material(Some(&request.private_key_pem), request.passphrase.as_ref()),
        &load_options(),
    )?;
    let mut command = key_test_command(request, &prepared)?;
    let output = command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .output()
        .map_err(|err| LocalShellError::Operation(err.to_string()).to_string())?;
    if output.status.success() {
        return Ok(true);
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    match host_key_failure_error(&request.host, port, prepared.pins(), &stderr) {
        Some(err) => Err(err),
        None => Ok(false),
    }
}

fn key_test_command(
    request: &SshKeyTestRequest,
    prepared: &PreparedSsh,
) -> Result<ProcessCommand, String> {
    let destination = ssh_destination(&request.host, &request.username)?;
    let mut command = ProcessCommand::new("ssh");
    command
        .args(prepared.ssh_options())
        .arg("-o")
        .arg("BatchMode=yes")
        .arg("-o")
        .arg("PasswordAuthentication=no")
        .arg("-o")
        .arg("KbdInteractiveAuthentication=no")
        .arg("-o")
        .arg("PreferredAuthentications=publickey")
        .arg("-o")
        .arg("ConnectTimeout=10")
        .arg("-p")
        .arg(request.port.max(1).to_string());
    if prepared.rsa_key() {
        rsa_key_compat_process_options(&mut command);
    }
    command.arg(destination).arg("true");
    Ok(command)
}

fn install_public_key_auth(
    request: &SshKeyInstallRequest,
) -> Result<SshKeyInstallResponse, String> {
    let public_key =
        public_key_install_value(Some(request.public_key.clone())).ok_or_else(|| {
            LocalShellError::Operation("authorized_keys public key is invalid".to_string())
                .to_string()
        })?;
    if request.password.is_empty() {
        return Err(
            LocalShellError::Operation("server password is required".to_string()).to_string(),
        );
    }
    let port = request.port.max(1);
    // Password login: no vault key involved, but the host must be pinned.
    let prepared = PreparedSsh::prepare(
        &request.host,
        port,
        &request.host_keys,
        None,
        &load_options(),
    )?;
    let context = InstallContext {
        request,
        prepared: &prepared,
        port,
    };

    if command_exists("ssh-copy-id") {
        match run_ssh_copy_id_install(&context, &public_key) {
            Ok(response) => Ok(response),
            Err(InstallError::HostKey(err)) => Err(err),
            Err(InstallError::Failed(_)) => run_manual_public_key_install(&context, &public_key)
                .map_err(InstallError::into_message),
        }
    } else {
        run_manual_public_key_install(&context, &public_key).map_err(InstallError::into_message)
    }
}

struct InstallContext<'a> {
    request: &'a SshKeyInstallRequest,
    prepared: &'a PreparedSsh,
    port: u16,
}

enum InstallError {
    /// Host-key verification failed; never retried with another method.
    HostKey(String),
    Failed(String),
}

impl InstallError {
    fn into_message(self) -> String {
        match self {
            Self::HostKey(message) | Self::Failed(message) => message,
        }
    }
}

fn run_ssh_copy_id_install(
    context: &InstallContext<'_>,
    public_key: &str,
) -> Result<SshKeyInstallResponse, InstallError> {
    let public_key_file = format!("{public_key}\n");
    let public_key_path = context
        .prepared
        .write_public_file("install.pub", public_key_file.as_bytes())
        .map_err(InstallError::Failed)?;
    let mut command = CommandBuilder::new("ssh-copy-id");
    command.arg("-f");
    command.arg("-i");
    command.arg(public_key_path.to_string_lossy().into_owned());
    command.arg("-p");
    command.arg(context.port.to_string());
    password_auth_options(&mut command, context.prepared);
    if public_key.starts_with("ssh-rsa ") {
        rsa_key_compat_options(&mut command);
    }
    command.arg(
        ssh_destination(&context.request.host, &context.request.username)
            .map_err(InstallError::Failed)?,
    );

    run_password_pty(command, context).map(|_| SshKeyInstallResponse {
        installed: true,
        method: "ssh-copy-id".to_string(),
    })
}

fn run_manual_public_key_install(
    context: &InstallContext<'_>,
    public_key: &str,
) -> Result<SshKeyInstallResponse, InstallError> {
    let mut command = CommandBuilder::new("ssh");
    password_auth_options(&mut command, context.prepared);
    if public_key.starts_with("ssh-rsa ") {
        rsa_key_compat_options(&mut command);
    }
    command.arg("-p");
    command.arg(context.port.to_string());
    command.arg(
        ssh_destination(&context.request.host, &context.request.username)
            .map_err(InstallError::Failed)?,
    );
    command.arg(install_public_key_command(public_key));

    run_password_pty(command, context).map(|_| SshKeyInstallResponse {
        installed: true,
        method: "manual".to_string(),
    })
}

fn password_auth_options(command: &mut CommandBuilder, prepared: &PreparedSsh) {
    for arg in prepared.ssh_options() {
        command.arg(arg);
    }
    command.arg("-o");
    command.arg("BatchMode=no");
    command.arg("-o");
    command.arg("PreferredAuthentications=password,keyboard-interactive");
    command.arg("-o");
    command.arg("PubkeyAuthentication=no");
    command.arg("-o");
    command.arg("IdentitiesOnly=yes");
    command.arg("-o");
    command.arg("IdentityAgent=none");
}

fn rsa_key_compat_options(command: &mut CommandBuilder) {
    command.arg("-o");
    command.arg("PubkeyAcceptedAlgorithms=+ssh-rsa");
    command.arg("-o");
    command.arg("HostkeyAlgorithms=+ssh-rsa");
}

pub(crate) fn rsa_key_compat_process_options(command: &mut ProcessCommand) {
    command.arg("-o");
    command.arg("PubkeyAcceptedAlgorithms=+ssh-rsa");
    command.arg("-o");
    command.arg("HostkeyAlgorithms=+ssh-rsa");
}

fn tunnel_forward_args(spec: &SshTunnelSpec) -> Result<Vec<String>, String> {
    match spec {
        SshTunnelSpec::Local {
            bind_host,
            bind_port,
            target_host,
            target_port,
        } => Ok(vec![
            "-L".to_string(),
            forward_address(bind_host, *bind_port, target_host, *target_port)?,
        ]),
        SshTunnelSpec::Remote {
            bind_host,
            bind_port,
            target_host,
            target_port,
        } => Ok(vec![
            "-R".to_string(),
            forward_address(bind_host, *bind_port, target_host, *target_port)?,
        ]),
        SshTunnelSpec::Socks {
            bind_host,
            bind_port,
        } => Ok(vec!["-D".to_string(), bind_address(bind_host, *bind_port)?]),
    }
}

fn forward_address(
    bind_host: &str,
    bind_port: u16,
    target_host: &str,
    target_port: u16,
) -> Result<String, String> {
    let target_host = target_host.trim();
    if target_host.is_empty() {
        return Err(
            LocalShellError::Operation("tunnel target host is required".to_string()).to_string(),
        );
    }

    Ok(format!(
        "{}:{}:{}:{}",
        bind_host_value(bind_host),
        valid_port(bind_port)?,
        target_host,
        valid_port(target_port)?
    ))
}

fn bind_address(bind_host: &str, bind_port: u16) -> Result<String, String> {
    Ok(format!(
        "{}:{}",
        bind_host_value(bind_host),
        valid_port(bind_port)?
    ))
}

fn bind_host_value(bind_host: &str) -> String {
    let bind_host = bind_host.trim();
    if bind_host.is_empty() {
        "127.0.0.1".to_string()
    } else {
        bind_host.to_string()
    }
}

fn valid_port(port: u16) -> Result<u16, String> {
    if port == 0 {
        return Err(
            LocalShellError::Operation("tunnel port must be greater than 0".to_string())
                .to_string(),
        );
    }

    Ok(port)
}

pub(crate) fn read_child_stderr(child: &mut ProcessChild) -> String {
    let mut output = String::new();
    if let Some(mut stderr) = child.stderr.take() {
        let _ = stderr.read_to_string(&mut output);
    }

    output
}

fn drain_child_stderr(stderr: Option<std::process::ChildStderr>) {
    if let Some(mut stderr) = stderr {
        thread::spawn(move || {
            let mut sink = [0_u8; 4096];
            while let Ok(size) = stderr.read(&mut sink) {
                if size == 0 {
                    break;
                }
            }
        });
    }
}

fn run_password_pty(
    command: CommandBuilder,
    context: &InstallContext<'_>,
) -> Result<(), InstallError> {
    let password = context.request.password.expose();
    let failed = |err: String| InstallError::Failed(LocalShellError::Operation(err).to_string());
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| failed(err.to_string()))?;
    let mut child = pair
        .slave
        .spawn_command(command)
        .map_err(|err| failed(err.to_string()))?;
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|err| failed(err.to_string()))?;
    let mut writer = pair
        .master
        .take_writer()
        .map_err(|err| failed(err.to_string()))?;
    let (tx, rx) = mpsc::channel::<Vec<u8>>();

    thread::spawn(move || {
        let mut buffer = [0_u8; 4096];
        while let Ok(size) = reader.read(&mut buffer) {
            if size == 0 {
                break;
            }
            if tx.send(buffer[..size].to_vec()).is_err() {
                break;
            }
        }
    });

    let deadline = Instant::now() + Duration::from_secs(60);
    let mut output = String::new();
    // Everything ssh printed, for classifying a failure.
    let mut transcript = String::new();
    let mut password_writes = 0_u8;

    loop {
        while let Ok(chunk) = rx.try_recv() {
            let text = String::from_utf8_lossy(&chunk);
            output.push_str(&text);
            transcript.push_str(&text);
            // Host-key prompts can't appear (StrictHostKeyChecking=yes), and
            // are never answered automatically.
            if needs_password(&output) && password_writes < 3 {
                writer
                    .write_all(password)
                    .and_then(|_| writer.write_all(b"\n"))
                    .map_err(|err| failed(err.to_string()))?;
                password_writes += 1;
                output.clear();
            }
        }

        if let Some(status) = child.try_wait().map_err(|err| failed(err.to_string()))? {
            if status.success() {
                return Ok(());
            }
            if let Some(err) = host_key_failure_error(
                &context.request.host,
                context.port,
                context.prepared.pins(),
                &transcript,
            ) {
                return Err(InstallError::HostKey(err));
            }
            return Err(failed(user_safe_ssh_error(&output, password)));
        }

        if Instant::now() >= deadline {
            let _ = child.kill();
            return Err(failed(format!(
                "SSH key install timed out: {}",
                user_safe_ssh_output(&output, password)
            )));
        }

        thread::sleep(Duration::from_millis(50));
    }
}

fn needs_password(output: &str) -> bool {
    let lower = output.to_ascii_lowercase();
    lower.contains("password:") || lower.contains("verification code:")
}

pub(crate) fn user_safe_ssh_error(output: &str, password: &[u8]) -> String {
    let details = user_safe_ssh_output(output, password);
    if details.is_empty() {
        "SSH key install failed".to_string()
    } else {
        format!("SSH key install failed: {details}")
    }
}

pub(crate) fn user_safe_ssh_output(output: &str, password: &[u8]) -> String {
    let password = std::str::from_utf8(password)
        .ok()
        .filter(|value| !value.is_empty());
    let mut lines = output
        .lines()
        .map(strip_control_chars)
        .filter(|line| !line.trim().is_empty())
        .map(|line| match password {
            Some(password) => line.replace(password, "[redacted]"),
            None => line,
        })
        .collect::<Vec<_>>();
    if lines.len() > 4 {
        lines = lines.split_off(lines.len() - 4);
    }

    lines.join(" ")
}

fn strip_control_chars(value: &str) -> String {
    value
        .chars()
        .filter(|ch| *ch == '\t' || !ch.is_control())
        .collect::<String>()
        .trim()
        .to_string()
}

fn command_exists(name: &str) -> bool {
    env::var_os("PATH").is_some_and(|paths| {
        env::split_paths(&paths).any(|path| {
            let candidate = path.join(name);
            candidate.is_file() || path.join(format!("{name}.exe")).is_file()
        })
    })
}

fn public_key_install_value(public_key: Option<String>) -> Option<String> {
    let public_key = public_key?;
    let public_key = public_key.trim();
    if public_key.is_empty() {
        return None;
    }
    if public_key.contains('\r') || public_key.contains('\n') {
        return None;
    }

    let mut parts = public_key.split_whitespace();
    let key_type = parts.next()?;
    parts.next()?;
    if !is_authorized_key_type(key_type) {
        return None;
    }

    Some(public_key.to_string())
}

fn is_authorized_key_type(key_type: &str) -> bool {
    key_type.starts_with("ssh-") || key_type.starts_with("ecdsa-") || key_type.starts_with("sk-")
}

fn install_public_key_command(public_key: &str) -> String {
    let public_key = shell_quote(public_key);
    format!(
        "umask 077; mkdir -p \"$HOME/.ssh\"; touch \"$HOME/.ssh/authorized_keys\"; grep -qxF {public_key} \"$HOME/.ssh/authorized_keys\" || printf '%s\\n' {public_key} >> \"$HOME/.ssh/authorized_keys\"; chmod 700 \"$HOME/.ssh\"; chmod 600 \"$HOME/.ssh/authorized_keys\""
    )
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

#[cfg(windows)]
fn default_shell() -> String {
    env::var("COMSPEC").unwrap_or_else(|_| "powershell.exe".to_string())
}

#[cfg(not(windows))]
fn default_shell() -> String {
    env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
}

#[cfg(test)]
mod tests {
    use super::{
        key_test_command, password_auth_options, terminal_ssh_command, tunnel_command,
        tunnel_forward_args, user_safe_ssh_error,
    };
    use portable_pty::CommandBuilder;
    use std::fs;
    use std::path::Path;
    use std::process::{Command, Stdio};
    use trominal_core::host_keys::HostKeyPin;
    use trominal_core::ssh_identity::{LoadOptions, PrivateDir};
    use trominal_core::ssh_session::{PreparedSsh, SshKeyMaterial};
    use trominal_core::{
        SecretBytes, SshConnectRequest, SshKeyTestRequest, SshTunnelOpenRequest, SshTunnelSpec,
    };

    const ED25519: &str = "AAAAC3NzaC1lZDI1NTE5AAAAIAJ0zOYsiehXYJEtufsQzfH49rgGwhlP1w6Ub9IZS3b9";

    fn pins() -> Vec<HostKeyPin> {
        vec![HostKeyPin {
            key_type: "ssh-ed25519".to_string(),
            public_key: ED25519.to_string(),
        }]
    }

    fn argv(command: &CommandBuilder) -> Vec<String> {
        command
            .get_argv()
            .iter()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect()
    }

    fn process_argv(command: &Command) -> Vec<String> {
        command
            .get_args()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect()
    }

    /// A real throwaway key, or `None` when ssh-keygen isn't available.
    fn generated_key() -> Option<SecretBytes> {
        let scratch = PrivateDir::create().ok()?;
        let path = scratch.path().join("k");
        let ok = Command::new("ssh-keygen")
            .args(["-q", "-t", "ed25519", "-N", "", "-f"])
            .arg(&path)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .is_ok_and(|status| status.success());
        ok.then(|| fs::read(&path).ok().map(SecretBytes::new))
            .flatten()
    }

    fn prepared_with_key(key: Option<&SecretBytes>) -> PreparedSsh {
        PreparedSsh::prepare(
            "example.com",
            22,
            &pins(),
            key.map(|private_key| SshKeyMaterial {
                private_key,
                passphrase: None,
            }),
            &LoadOptions::default(),
        )
        .expect("prepare")
    }

    fn assert_shared_policy(args: &[String]) {
        let joined = args.join(" ");
        assert!(!joined.contains("accept-new"), "{joined}");
        assert!(!joined.contains("StrictHostKeyChecking=no"), "{joined}");
        assert!(args.contains(&"StrictHostKeyChecking=yes".to_string()));
        assert!(args
            .iter()
            .any(|arg| arg.starts_with("UserKnownHostsFile=")));
        assert!(args
            .iter()
            .any(|arg| arg.starts_with("GlobalKnownHostsFile=")));
        assert!(args
            .iter()
            .any(|arg| arg == "HostKeyAlias=trominal-pinned-host"));
        // Policy options come before anything else that could override them.
        let strict = args
            .iter()
            .position(|arg| arg == "StrictHostKeyChecking=yes")
            .unwrap();
        assert!(args.iter().take(strict).all(|arg| arg != "BatchMode=no"));
    }

    /// No argument may name a file that holds private key material.
    fn assert_no_private_key_files(args: &[String]) {
        for arg in args {
            let candidate = arg.trim_matches('"');
            let path = candidate
                .split_once('=')
                .map_or(candidate, |(_, value)| value.trim_matches('"'));
            if Path::new(path).is_file() {
                let contents = fs::read(path).unwrap_or_default();
                assert!(
                    !contents.windows(11).any(|window| window == b"PRIVATE KEY"),
                    "private key on disk at {path}"
                );
            }
        }
    }

    fn connect_request(json: &str) -> SshConnectRequest {
        serde_json::from_str(json).expect("request")
    }

    #[test]
    fn terminal_ssh_never_writes_the_private_key_to_disk() {
        let Some(key) = generated_key() else {
            eprintln!("skipping: ssh-keygen unavailable");
            return;
        };
        let prepared = prepared_with_key(Some(&key));
        let request = connect_request(
            r#"{"sessionId":"s","host":"example.com","port":22,"username":"deploy","cols":80,"rows":24}"#,
        );
        let args = argv(&terminal_ssh_command(&request, &prepared).unwrap());
        assert_shared_policy(&args);
        assert_no_private_key_files(&args);
        #[cfg(unix)]
        {
            assert!(args
                .iter()
                .any(|arg| arg.starts_with("IdentityAgent=") && arg != "IdentityAgent=none"));
            assert!(args.contains(&"IdentitiesOnly=yes".to_string()));
        }
        assert_eq!(args.last().map(String::as_str), Some("deploy@example.com"));
    }

    #[test]
    fn terminal_ssh_without_vault_key_still_pins_the_host() {
        let prepared = prepared_with_key(None);
        let request = connect_request(
            r#"{"sessionId":"s","host":"example.com","port":2222,"username":"","cols":80,"rows":24}"#,
        );
        let args = argv(&terminal_ssh_command(&request, &prepared).unwrap());
        assert_shared_policy(&args);
        assert!(!args.contains(&"-i".to_string()));
        assert!(args.contains(&"2222".to_string()));
    }

    #[test]
    fn rejects_hosts_and_users_that_look_like_options() {
        let prepared = prepared_with_key(None);
        let request = connect_request(
            r#"{"sessionId":"s","host":"-oProxyCommand=evil","port":22,"username":"u","cols":80,"rows":24}"#,
        );
        assert!(terminal_ssh_command(&request, &prepared).is_err());
        let request = connect_request(
            r#"{"sessionId":"s","host":"h","port":22,"username":"-oProxyCommand=evil","cols":80,"rows":24}"#,
        );
        assert!(terminal_ssh_command(&request, &prepared).is_err());
    }

    #[test]
    fn tunnels_and_key_tests_use_the_shared_policy() {
        let Some(key) = generated_key() else {
            eprintln!("skipping: ssh-keygen unavailable");
            return;
        };
        let prepared = prepared_with_key(Some(&key));

        let tunnel: SshTunnelOpenRequest = serde_json::from_str(
            r#"{"sessionId":"t","host":"example.com","port":22,"username":"u","privateKeyPem":[1],
                "tunnel":{"kind":"local","bindHost":"","bindPort":15432,"targetHost":"db","targetPort":5432}}"#,
        )
        .unwrap();
        let args = process_argv(&tunnel_command(&tunnel, &prepared).unwrap());
        assert_shared_policy(&args);
        assert_no_private_key_files(&args);
        assert!(args.contains(&"127.0.0.1:15432:db:5432".to_string()));

        let test: SshKeyTestRequest = serde_json::from_str(
            r#"{"host":"example.com","port":22,"username":"u","privateKeyPem":[1]}"#,
        )
        .unwrap();
        let args = process_argv(&key_test_command(&test, &prepared).unwrap());
        assert_shared_policy(&args);
        assert_no_private_key_files(&args);
    }

    #[test]
    fn key_install_never_accepts_unknown_host_keys() {
        let prepared = prepared_with_key(None);
        let mut command = CommandBuilder::new("ssh");
        password_auth_options(&mut command, &prepared);
        let args = argv(&command);
        assert_shared_policy(&args);
    }

    #[test]
    fn requests_without_pins_are_refused() {
        let err = PreparedSsh::prepare("example.com", 22, &[], None, &LoadOptions::default())
            .unwrap_err();
        assert!(err.starts_with("trominal-host-key:"));
    }

    /// Manual end-to-end check against a real sshd. Run with
    /// `TROMINAL_E2E_SSH=host:port:user:/path/to/private_key cargo test -p trominal-client -- --ignored e2e`.
    #[test]
    #[ignore = "needs a reachable sshd; see doc comment"]
    fn e2e_key_auth_and_host_key_pinning_against_real_sshd() {
        use super::test_private_key_auth;
        use trominal_core::host_keys::{scan_host_keys, HOST_KEY_ERROR_PREFIX};

        let spec = std::env::var("TROMINAL_E2E_SSH").expect("TROMINAL_E2E_SSH");
        let mut parts = spec.splitn(4, ':');
        let (host, port, user, key_path) = (
            parts.next().unwrap().to_string(),
            parts.next().unwrap().parse::<u16>().unwrap(),
            parts.next().unwrap().to_string(),
            parts.next().unwrap().to_string(),
        );
        let key: Vec<u8> = fs::read(&key_path).unwrap();
        let scanned = scan_host_keys(&host, port).expect("scan");
        let request = |pins: Vec<serde_json::Value>| -> SshKeyTestRequest {
            serde_json::from_value(serde_json::json!({
                "host": host, "port": port, "username": user,
                "privateKeyPem": key, "hostKeys": pins,
            }))
            .unwrap()
        };
        let approved: Vec<serde_json::Value> = scanned
            .iter()
            .map(|k| serde_json::json!({"keyType": k.key_type, "publicKey": k.public_key}))
            .collect();

        assert_eq!(test_private_key_auth(&request(approved)), Ok(true));

        let wrong = vec![serde_json::json!({
            "keyType": "ssh-ed25519",
            "publicKey": "AAAAC3NzaC1lZDI1NTE5AAAAIB0DWUzzfmsj0qLl7lZVRfhNC1x98nyQCs4PbVsvm0ob",
        })];
        let err = test_private_key_auth(&request(wrong)).unwrap_err();
        assert!(err.starts_with(HOST_KEY_ERROR_PREFIX), "{err}");
        assert!(err.contains("\"changed\""), "{err}");

        let err = test_private_key_auth(&request(Vec::new())).unwrap_err();
        assert!(err.contains("\"unknown\""), "{err}");
    }

    #[test]
    fn sanitizes_password_from_ssh_install_errors() {
        let error = user_safe_ssh_error(
            "user@example password: hunter2\nPermission denied",
            b"hunter2",
        );

        assert!(error.contains("[redacted]"));
        assert!(!error.contains("hunter2"));
        assert!(error.contains("Permission denied"));
    }

    #[test]
    fn builds_local_tunnel_forward_args() {
        let args = tunnel_forward_args(&SshTunnelSpec::Local {
            bind_host: "127.0.0.1".to_string(),
            bind_port: 15432,
            target_host: "db.internal".to_string(),
            target_port: 5432,
        })
        .expect("local tunnel args");

        assert_eq!(args, vec!["-L", "127.0.0.1:15432:db.internal:5432"]);
    }

    #[test]
    fn builds_remote_tunnel_forward_args() {
        let args = tunnel_forward_args(&SshTunnelSpec::Remote {
            bind_host: "0.0.0.0".to_string(),
            bind_port: 9000,
            target_host: "localhost".to_string(),
            target_port: 9000,
        })
        .expect("remote tunnel args");

        assert_eq!(args, vec!["-R", "0.0.0.0:9000:localhost:9000"]);
    }

    #[test]
    fn builds_socks_tunnel_forward_args() {
        let args = tunnel_forward_args(&SshTunnelSpec::Socks {
            bind_host: "".to_string(),
            bind_port: 1080,
        })
        .expect("socks tunnel args");

        assert_eq!(args, vec!["-D", "127.0.0.1:1080"]);
    }
}
