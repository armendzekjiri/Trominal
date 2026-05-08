use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::fs::{self, OpenOptions};
use std::io::{Read, Write};
#[cfg(unix)]
use std::os::unix::fs::OpenOptionsExt;
use std::path::{Path, PathBuf};
use std::process::{Command as ProcessCommand, Stdio};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};
use thiserror::Error;

#[derive(Default)]
pub struct LocalShellState {
    sessions: Mutex<HashMap<String, LocalShellSession>>,
}

struct LocalShellSession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
    temp_paths: Vec<PathBuf>,
}

#[derive(Debug, Error)]
enum LocalShellError {
    #[error("local shell session was not found")]
    MissingSession,
    #[error("local shell operation failed: {0}")]
    Operation(String),
    #[error("local shell state is unavailable")]
    Locked,
}

#[derive(Clone, Serialize)]
struct LocalShellData {
    session_id: String,
    data: Vec<u8>,
}

#[derive(Clone, Serialize)]
struct LocalShellClosed {
    session_id: String,
    reason: String,
}

struct PtyGeometry {
    cols: u16,
    rows: u16,
}

struct PtyEvents {
    data: &'static str,
    closed: &'static str,
}

struct PtyCommand {
    command: CommandBuilder,
    temp_paths: Vec<PathBuf>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshConnectRequest {
    session_id: String,
    host: String,
    port: u16,
    username: String,
    cols: u16,
    rows: u16,
    private_key_pem: Option<Vec<u8>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshKeyTestRequest {
    host: String,
    port: u16,
    username: String,
    private_key_pem: Vec<u8>,
}

#[derive(Serialize)]
pub struct SshKeyTestResponse {
    works: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshKeyInstallRequest {
    host: String,
    port: u16,
    username: String,
    public_key: String,
    password: Vec<u8>,
}

#[derive(Serialize)]
pub struct SshKeyInstallResponse {
    installed: bool,
    method: String,
}

#[tauri::command]
pub fn local_shell_open(
    app: AppHandle,
    state: State<'_, Arc<LocalShellState>>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<String, String> {
    open_pty_session(
        app,
        state,
        session_id,
        shell_command(),
        Vec::new(),
        PtyGeometry { cols, rows },
        PtyEvents {
            data: "local-shell://data",
            closed: "local-shell://closed",
        },
    )
}

#[tauri::command]
pub fn ssh_connect(
    app: AppHandle,
    state: State<'_, Arc<LocalShellState>>,
    request: SshConnectRequest,
) -> Result<String, String> {
    let session_id = require_session_id(request.session_id)?;
    let pty_command = ssh_command(
        &session_id,
        request.host,
        request.port,
        request.username,
        request.private_key_pem,
    )?;

    open_pty_session(
        app,
        state,
        session_id,
        pty_command.command,
        pty_command.temp_paths,
        PtyGeometry {
            cols: request.cols,
            rows: request.rows,
        },
        PtyEvents {
            data: "ssh://data",
            closed: "ssh://closed",
        },
    )
}

#[tauri::command]
pub fn ssh_key_test(request: SshKeyTestRequest) -> Result<SshKeyTestResponse, String> {
    let works = test_private_key_auth(request)?;
    Ok(SshKeyTestResponse { works })
}

#[tauri::command]
pub fn ssh_key_install(request: SshKeyInstallRequest) -> Result<SshKeyInstallResponse, String> {
    install_public_key_auth(request)
}

fn open_pty_session(
    app: AppHandle,
    state: State<'_, Arc<LocalShellState>>,
    session_id: String,
    command: CommandBuilder,
    temp_paths: Vec<PathBuf>,
    geometry: PtyGeometry,
    events: PtyEvents,
) -> Result<String, String> {
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
            LocalShellError::Operation(err.to_string()).to_string()
        })?;

    let mut child = pair.slave.spawn_command(command).map_err(|err| {
        cleanup_temp_paths(&temp_paths);
        LocalShellError::Operation(err.to_string()).to_string()
    })?;

    let reader = match pair.master.try_clone_reader() {
        Ok(reader) => reader,
        Err(err) => {
            let _ = child.kill();
            cleanup_temp_paths(&temp_paths);
            return Err(LocalShellError::Operation(err.to_string()).to_string());
        }
    };
    let writer = match pair.master.take_writer() {
        Ok(writer) => writer,
        Err(err) => {
            let _ = child.kill();
            cleanup_temp_paths(&temp_paths);
            return Err(LocalShellError::Operation(err.to_string()).to_string());
        }
    };
    let state_for_reader = Arc::clone(state.inner());

    let mut sessions = match state.sessions.lock() {
        Ok(sessions) => sessions,
        Err(_) => {
            let _ = child.kill();
            cleanup_temp_paths(&temp_paths);
            return Err(LocalShellError::Locked.to_string());
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

    spawn_reader(app, state_for_reader, id.clone(), reader, events);

    Ok(id)
}

#[tauri::command]
pub fn local_shell_write(
    state: State<'_, Arc<LocalShellState>>,
    session_id: String,
    data: Vec<u8>,
) -> Result<(), String> {
    write_session(state, session_id, data)
}

#[tauri::command]
pub fn ssh_write(
    state: State<'_, Arc<LocalShellState>>,
    session_id: String,
    data: Vec<u8>,
) -> Result<(), String> {
    write_session(state, session_id, data)
}

fn write_session(
    state: State<'_, Arc<LocalShellState>>,
    session_id: String,
    data: Vec<u8>,
) -> Result<(), String> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| LocalShellError::Locked.to_string())?;
    let session = sessions
        .get_mut(&session_id)
        .ok_or(LocalShellError::MissingSession)
        .map_err(|err| err.to_string())?;

    session
        .writer
        .write_all(&data)
        .map_err(|err| LocalShellError::Operation(err.to_string()).to_string())
}

#[tauri::command]
pub fn local_shell_resize(
    state: State<'_, Arc<LocalShellState>>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    resize_session(state, session_id, cols, rows)
}

#[tauri::command]
pub fn ssh_resize(
    state: State<'_, Arc<LocalShellState>>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    resize_session(state, session_id, cols, rows)
}

fn resize_session(
    state: State<'_, Arc<LocalShellState>>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let sessions = state
        .sessions
        .lock()
        .map_err(|_| LocalShellError::Locked.to_string())?;
    let session = sessions
        .get(&session_id)
        .ok_or(LocalShellError::MissingSession)
        .map_err(|err| err.to_string())?;

    session
        .master
        .resize(PtySize {
            rows: rows.max(1),
            cols: cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| LocalShellError::Operation(err.to_string()))
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn local_shell_close(
    state: State<'_, Arc<LocalShellState>>,
    session_id: String,
) -> Result<(), String> {
    close_session(state, session_id)
}

#[tauri::command]
pub fn ssh_close(state: State<'_, Arc<LocalShellState>>, session_id: String) -> Result<(), String> {
    close_session(state, session_id)
}

fn close_session(state: State<'_, Arc<LocalShellState>>, session_id: String) -> Result<(), String> {
    let session = state
        .sessions
        .lock()
        .map_err(|_| LocalShellError::Locked.to_string())?
        .remove(&session_id);

    if let Some(mut session) = session {
        let kill_result = session
            .child
            .kill()
            .map_err(|err| LocalShellError::Operation(err.to_string()))
            .map_err(|err| err.to_string());
        cleanup_temp_paths(&session.temp_paths);
        kill_result?;
    }

    Ok(())
}

fn spawn_reader(
    app: AppHandle,
    state: Arc<LocalShellState>,
    session_id: String,
    mut reader: Box<dyn Read + Send>,
    events: PtyEvents,
) {
    std::thread::spawn(move || {
        let mut buffer = [0_u8; 8192];

        loop {
            match reader.read(&mut buffer) {
                Ok(0) => {
                    emit_closed(&app, events.closed, &session_id, "closed".to_string());
                    remove_session(&state, &session_id);
                    break;
                }
                Ok(size) => {
                    let _ = app.emit(
                        events.data,
                        LocalShellData {
                            session_id: session_id.clone(),
                            data: buffer[..size].to_vec(),
                        },
                    );
                }
                Err(err) => {
                    emit_closed(&app, events.closed, &session_id, err.to_string());
                    remove_session(&state, &session_id);
                    break;
                }
            }
        }
    });
}

fn emit_closed(app: &AppHandle, event: &'static str, session_id: &str, reason: String) {
    let _ = app.emit(
        event,
        LocalShellClosed {
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

fn cleanup_temp_paths(paths: &[PathBuf]) {
    for path in paths {
        let _ = fs::remove_file(path);
    }
}

fn require_session_id(session_id: String) -> Result<String, String> {
    if session_id.is_empty() {
        return Err(LocalShellError::Operation("session id is required".to_string()).to_string());
    }

    Ok(session_id)
}

fn shell_command() -> CommandBuilder {
    let shell = default_shell();
    let mut command = CommandBuilder::new(shell);
    command.env("TERM", "xterm-256color");
    command
}

fn ssh_command(
    session_id: &str,
    host: String,
    port: u16,
    username: String,
    private_key_pem: Option<Vec<u8>>,
) -> Result<PtyCommand, String> {
    let host = host.trim();
    let username = username.trim();
    let mut temp_paths = Vec::new();
    let mut rsa_private_key = false;

    if host.is_empty() {
        return Err(LocalShellError::Operation("host is required".to_string()).to_string());
    }

    let destination = if username.is_empty() {
        host.to_string()
    } else {
        format!("{username}@{host}")
    };
    let port = port.max(1).to_string();

    let mut command = CommandBuilder::new("ssh");
    if let Some(mut private_key_pem) = private_key_pem {
        rsa_private_key = is_rsa_private_key(&private_key_pem);
        let key_path = write_temp_ssh_file(session_id, "key", &private_key_pem);
        private_key_pem.fill(0);
        let key_path = key_path?;
        let config_path = match write_temp_ssh_file(session_id, "config", &[]) {
            Ok(path) => path,
            Err(err) => {
                cleanup_temp_paths(std::slice::from_ref(&key_path));
                return Err(err);
            }
        };
        command.arg("-F");
        command.arg(path_to_arg(&config_path));
        command.arg("-i");
        command.arg(path_to_arg(&key_path));
        command.arg("-o");
        command.arg("IdentitiesOnly=yes");
        command.arg("-o");
        command.arg("IdentityAgent=none");
        temp_paths.push(key_path);
        temp_paths.push(config_path);
    }
    command.arg("-tt");
    command.arg("-p");
    command.arg(port);
    command.arg("-o");
    command.arg("BatchMode=no");
    command.arg("-o");
    command.arg("PreferredAuthentications=publickey,password,keyboard-interactive");
    if rsa_private_key {
        rsa_key_compat_options(&mut command);
    }
    command.arg(destination);
    command.env("TERM", "xterm-256color");

    Ok(PtyCommand {
        command,
        temp_paths,
    })
}

fn test_private_key_auth(mut request: SshKeyTestRequest) -> Result<bool, String> {
    let rsa_private_key = is_rsa_private_key(&request.private_key_pem);
    let key_path = write_temp_ssh_file("key-test", "key", &request.private_key_pem);
    request.private_key_pem.fill(0);
    let key_path = key_path?;
    let config_path = match write_temp_ssh_file("key-test", "config", &[]) {
        Ok(path) => path,
        Err(err) => {
            cleanup_temp_paths(std::slice::from_ref(&key_path));
            return Err(err);
        }
    };
    let temp_paths = vec![key_path.clone(), config_path.clone()];
    let mut command = ProcessCommand::new("ssh");
    command
        .arg("-F")
        .arg(&config_path)
        .arg("-i")
        .arg(&key_path)
        .arg("-o")
        .arg("BatchMode=yes")
        .arg("-o")
        .arg("PasswordAuthentication=no")
        .arg("-o")
        .arg("KbdInteractiveAuthentication=no")
        .arg("-o")
        .arg("PreferredAuthentications=publickey")
        .arg("-o")
        .arg("IdentitiesOnly=yes")
        .arg("-o")
        .arg("IdentityAgent=none")
        .arg("-o")
        .arg("StrictHostKeyChecking=accept-new")
        .arg("-o")
        .arg("ConnectTimeout=10")
        .arg("-p")
        .arg(request.port.max(1).to_string());
    if rsa_private_key {
        rsa_key_compat_process_options(&mut command);
    }
    command
        .arg(destination(&request.host, &request.username)?)
        .arg("true")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    let status = command.status();
    cleanup_temp_paths(&temp_paths);

    match status {
        Ok(status) => Ok(status.success()),
        Err(err) => Err(LocalShellError::Operation(err.to_string()).to_string()),
    }
}

fn install_public_key_auth(
    mut request: SshKeyInstallRequest,
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

    let result = if command_exists("ssh-copy-id") {
        run_ssh_copy_id_install(&request, &public_key, &request.password)
            .or_else(|_| run_manual_public_key_install(&request, &public_key, &request.password))
    } else {
        run_manual_public_key_install(&request, &public_key, &request.password)
    };
    request.password.fill(0);
    result
}

fn run_ssh_copy_id_install(
    request: &SshKeyInstallRequest,
    public_key: &str,
    password: &[u8],
) -> Result<SshKeyInstallResponse, String> {
    let public_key_file = format!("{public_key}\n");
    let public_key_path =
        write_temp_ssh_file("key-install", "key.pub", public_key_file.as_bytes())?;
    let mut command = CommandBuilder::new("ssh-copy-id");
    command.arg("-f");
    command.arg("-i");
    command.arg(path_to_arg(&public_key_path));
    command.arg("-p");
    command.arg(request.port.max(1).to_string());
    password_auth_options(&mut command);
    if public_key.starts_with("ssh-rsa ") {
        rsa_key_compat_options(&mut command);
    }
    command.arg(destination(&request.host, &request.username)?);

    let result = run_password_pty(command, password);
    cleanup_temp_paths(&[public_key_path]);
    result.map(|_| SshKeyInstallResponse {
        installed: true,
        method: "ssh-copy-id".to_string(),
    })
}

fn run_manual_public_key_install(
    request: &SshKeyInstallRequest,
    public_key: &str,
    password: &[u8],
) -> Result<SshKeyInstallResponse, String> {
    let mut command = CommandBuilder::new("ssh");
    password_auth_options(&mut command);
    if public_key.starts_with("ssh-rsa ") {
        rsa_key_compat_options(&mut command);
    }
    command.arg("-p");
    command.arg(request.port.max(1).to_string());
    command.arg(destination(&request.host, &request.username)?);
    command.arg(install_public_key_command(public_key));

    run_password_pty(command, password).map(|_| SshKeyInstallResponse {
        installed: true,
        method: "manual".to_string(),
    })
}

fn password_auth_options(command: &mut CommandBuilder) {
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
    command.arg("-o");
    command.arg("StrictHostKeyChecking=accept-new");
}

fn rsa_key_compat_options(command: &mut CommandBuilder) {
    command.arg("-o");
    command.arg("PubkeyAcceptedAlgorithms=+ssh-rsa");
    command.arg("-o");
    command.arg("HostkeyAlgorithms=+ssh-rsa");
}

fn rsa_key_compat_process_options(command: &mut ProcessCommand) {
    command.arg("-o");
    command.arg("PubkeyAcceptedAlgorithms=+ssh-rsa");
    command.arg("-o");
    command.arg("HostkeyAlgorithms=+ssh-rsa");
}

fn run_password_pty(command: CommandBuilder, password: &[u8]) -> Result<(), String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| LocalShellError::Operation(err.to_string()).to_string())?;
    let mut child = pair
        .slave
        .spawn_command(command)
        .map_err(|err| LocalShellError::Operation(err.to_string()).to_string())?;
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|err| LocalShellError::Operation(err.to_string()).to_string())?;
    let mut writer = pair
        .master
        .take_writer()
        .map_err(|err| LocalShellError::Operation(err.to_string()).to_string())?;
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
    let mut password_writes = 0_u8;

    loop {
        while let Ok(chunk) = rx.try_recv() {
            output.push_str(&String::from_utf8_lossy(&chunk));
            if needs_confirmation(&output) {
                writer
                    .write_all(b"yes\n")
                    .map_err(|err| LocalShellError::Operation(err.to_string()).to_string())?;
                output.clear();
            } else if needs_password(&output) && password_writes < 3 {
                writer
                    .write_all(password)
                    .and_then(|_| writer.write_all(b"\n"))
                    .map_err(|err| LocalShellError::Operation(err.to_string()).to_string())?;
                password_writes += 1;
                output.clear();
            }
        }

        if let Some(status) = child
            .try_wait()
            .map_err(|err| LocalShellError::Operation(err.to_string()).to_string())?
        {
            return if status.success() {
                Ok(())
            } else {
                Err(LocalShellError::Operation(user_safe_ssh_error(&output, password)).to_string())
            };
        }

        if Instant::now() >= deadline {
            let _ = child.kill();
            return Err(LocalShellError::Operation(format!(
                "SSH key install timed out: {}",
                user_safe_ssh_output(&output, password)
            ))
            .to_string());
        }

        thread::sleep(Duration::from_millis(50));
    }
}

fn needs_password(output: &str) -> bool {
    let lower = output.to_ascii_lowercase();
    lower.contains("password:") || lower.contains("verification code:")
}

fn needs_confirmation(output: &str) -> bool {
    output
        .to_ascii_lowercase()
        .contains("are you sure you want to continue connecting")
}

fn is_rsa_private_key(contents: &[u8]) -> bool {
    let text = String::from_utf8_lossy(contents);
    text.contains("-----BEGIN RSA PRIVATE KEY-----") || text.contains("-----BEGIN PRIVATE KEY-----")
}

fn user_safe_ssh_error(output: &str, password: &[u8]) -> String {
    let details = user_safe_ssh_output(output, password);
    if details.is_empty() {
        "SSH key install failed".to_string()
    } else {
        format!("SSH key install failed: {details}")
    }
}

fn user_safe_ssh_output(output: &str, password: &[u8]) -> String {
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

fn destination(host: &str, username: &str) -> Result<String, String> {
    let host = host.trim();
    let username = username.trim();
    if host.is_empty() {
        return Err(LocalShellError::Operation("host is required".to_string()).to_string());
    }

    Ok(if username.is_empty() {
        host.to_string()
    } else {
        format!("{username}@{host}")
    })
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

fn write_temp_ssh_file(session_id: &str, suffix: &str, contents: &[u8]) -> Result<PathBuf, String> {
    let safe_id = sanitize_session_id(session_id)?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    let path = env::temp_dir().join(format!("trominal-{safe_id}-{suffix}-{timestamp}"));
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    options.mode(0o600);

    let mut file = options
        .open(&path)
        .map_err(|err| LocalShellError::Operation(err.to_string()).to_string())?;
    if let Err(err) = file.write_all(contents) {
        let _ = fs::remove_file(&path);
        return Err(LocalShellError::Operation(err.to_string()).to_string());
    }

    Ok(path)
}

fn sanitize_session_id(session_id: &str) -> Result<String, String> {
    let safe: String = session_id
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || *ch == '-' || *ch == '_')
        .collect();

    if safe.is_empty() {
        return Err(LocalShellError::Operation("session id is required".to_string()).to_string());
    }

    Ok(safe)
}

fn path_to_arg(path: &Path) -> String {
    path.to_string_lossy().into_owned()
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
    use super::{is_rsa_private_key, user_safe_ssh_error};

    #[test]
    fn detects_rsa_private_key_pem_headers() {
        assert!(is_rsa_private_key(
            b"-----BEGIN RSA PRIVATE KEY-----\nkey\n-----END RSA PRIVATE KEY-----"
        ));
        assert!(is_rsa_private_key(
            b"-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----"
        ));
        assert!(!is_rsa_private_key(
            b"-----BEGIN OPENSSH PRIVATE KEY-----\nkey\n-----END OPENSSH PRIVATE KEY-----"
        ));
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
}
