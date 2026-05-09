//! SFTP via the system `sftp` binary in batch mode.
//!
//! Mirrors the design choice from Phase 5.2: shell out to OpenSSH (`sftp`)
//! rather than pulling in a parallel Rust SFTP crate, so we automatically
//! inherit the same auth, host-key, and config behaviour the rest of the
//! app already negotiates via `ssh_connect`.
//!
//! Each request runs `sftp -b - -P <port> -i <key> user@host` with a small
//! batch script piped over stdin. The directory listing parser handles the
//! `ls -la` output that `sftp` produces. Uploads and downloads run on a
//! background thread and emit `sftp://transfer` events; clients can call
//! `sftp_cancel` to kill the in-flight child.

use std::collections::HashMap;
use std::env;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command as ProcessCommand, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Emitter, State};
use thiserror::Error;
use trominal_core::{
    LocalHomeResponse, LocalListRequest, LocalListResponse, SftpEntry, SftpHomeRequest,
    SftpHomeResponse, SftpHostArgs, SftpListRequest, SftpListResponse, SftpPathRequest,
    SftpRemoveRequest, SftpRenameRequest, SftpTransferEvent, SftpTransferRequest,
    SftpTransferStartResponse,
};

use crate::local_shell::{
    cleanup_temp_paths, destination, is_rsa_private_key, read_child_stderr,
    rsa_key_compat_process_options, user_safe_ssh_error, user_safe_ssh_output, write_temp_ssh_file,
};

#[derive(Default)]
pub struct SftpState {
    transfers: Mutex<HashMap<String, TransferHandle>>,
}

struct TransferHandle {
    /// `Some(child)` while running; consumed when the monitor thread exits.
    child: Arc<Mutex<Option<Child>>>,
    temp_paths: Vec<PathBuf>,
}

#[derive(Debug, Error)]
enum SftpError {
    #[error("sftp state is unavailable")]
    Locked,
    #[error("sftp operation failed: {0}")]
    Operation(String),
    #[error("sftp transfer is unknown or already finished")]
    MissingTransfer,
}

// ---------- Tauri commands ----------

#[tauri::command]
pub fn sftp_list(request: SftpListRequest) -> Result<SftpListResponse, String> {
    let SftpListRequest { host, remote_path } = request;
    let path = clean_remote_path(&remote_path);
    // OpenSSH `sftp` returns absolute names from `ls /path`, so a click on a
    // child folder would join `/home` + `/home/ubuntu` = `/home//home/ubuntu`.
    // `cd` first, then a bare `ls -la`, gives plain relative names that the
    // joinPath helper on the frontend can compose without surprises.
    let batch = format!("cd {}\nls -la\n", quote_remote(&path));
    let stdout = run_sftp_batch(&host, "list", batch.as_bytes())?;
    let entries = parse_sftp_listing(&stdout);
    Ok(SftpListResponse { entries })
}

#[tauri::command]
pub fn sftp_remote_home(request: SftpHomeRequest) -> Result<SftpHomeResponse, String> {
    let SftpHomeRequest { host } = request;
    // `pwd` after a fresh sftp connection reports the user's default working
    // directory, which on every common server (OpenSSH, AWS Transfer, etc.)
    // is the user's home unless the admin chrooted or pinned it.
    let stdout = run_sftp_batch(&host, "home", b"pwd\n")?;
    let path = extract_pwd_path(&stdout)
        .ok_or_else(|| SftpError::Operation("could not parse pwd output".to_string()).to_string())?;
    Ok(SftpHomeResponse { path })
}

#[tauri::command]
pub fn sftp_mkdir(request: SftpPathRequest) -> Result<(), String> {
    let SftpPathRequest { host, remote_path } = request;
    if remote_path.trim().is_empty() {
        return Err(SftpError::Operation("remote path is required".to_string()).to_string());
    }
    let batch = format!("mkdir {}\n", quote_remote(&remote_path));
    run_sftp_batch(&host, "mkdir", batch.as_bytes()).map(|_| ())
}

#[tauri::command]
pub fn sftp_remove(request: SftpRemoveRequest) -> Result<(), String> {
    let SftpRemoveRequest {
        host,
        remote_path,
        is_dir,
    } = request;
    if remote_path.trim().is_empty() {
        return Err(SftpError::Operation("remote path is required".to_string()).to_string());
    }
    let cmd = if is_dir { "rmdir" } else { "rm" };
    let batch = format!("{} {}\n", cmd, quote_remote(&remote_path));
    run_sftp_batch(&host, "remove", batch.as_bytes()).map(|_| ())
}

#[tauri::command]
pub fn sftp_rename(request: SftpRenameRequest) -> Result<(), String> {
    let SftpRenameRequest {
        host,
        from_path,
        to_path,
    } = request;
    if from_path.trim().is_empty() || to_path.trim().is_empty() {
        return Err(SftpError::Operation("rename paths are required".to_string()).to_string());
    }
    let batch = format!(
        "rename {} {}\n",
        quote_remote(&from_path),
        quote_remote(&to_path)
    );
    run_sftp_batch(&host, "rename", batch.as_bytes()).map(|_| ())
}

#[tauri::command]
pub fn sftp_upload(
    app: AppHandle,
    state: State<'_, Arc<SftpState>>,
    request: SftpTransferRequest,
) -> Result<SftpTransferStartResponse, String> {
    let SftpTransferRequest {
        transfer_id,
        host,
        local_path,
        remote_path,
    } = request;
    if local_path.trim().is_empty() || remote_path.trim().is_empty() {
        return Err(SftpError::Operation("transfer paths are required".to_string()).to_string());
    }
    let batch = format!(
        "put {} {}\n",
        quote_local(&local_path),
        quote_remote(&remote_path)
    );
    spawn_transfer(app, state, transfer_id, host, "upload", batch)
}

#[tauri::command]
pub fn sftp_download(
    app: AppHandle,
    state: State<'_, Arc<SftpState>>,
    request: SftpTransferRequest,
) -> Result<SftpTransferStartResponse, String> {
    let SftpTransferRequest {
        transfer_id,
        host,
        local_path,
        remote_path,
    } = request;
    if local_path.trim().is_empty() || remote_path.trim().is_empty() {
        return Err(SftpError::Operation("transfer paths are required".to_string()).to_string());
    }
    let batch = format!(
        "get {} {}\n",
        quote_remote(&remote_path),
        quote_local(&local_path)
    );
    spawn_transfer(app, state, transfer_id, host, "download", batch)
}

#[tauri::command]
pub fn sftp_cancel(
    state: State<'_, Arc<SftpState>>,
    transfer_id: String,
) -> Result<(), String> {
    let mut transfers = state.transfers.lock().map_err(|_| SftpError::Locked.to_string())?;
    let Some(handle) = transfers.remove(&transfer_id) else {
        return Err(SftpError::MissingTransfer.to_string());
    };
    if let Ok(mut child) = handle.child.lock() {
        if let Some(mut child) = child.take() {
            let _ = child.kill();
            // Drain to avoid leaving zombies on Unix.
            let _ = child.wait();
        }
    }
    cleanup_temp_paths(&handle.temp_paths);
    Ok(())
}

// ---------- Internals ----------

fn spawn_transfer(
    app: AppHandle,
    state: State<'_, Arc<SftpState>>,
    transfer_id: String,
    host: SftpHostArgs,
    label: &'static str,
    batch: String,
) -> Result<SftpTransferStartResponse, String> {
    let transfer_id = require_transfer_id(transfer_id)?;
    let (mut command, temp_paths) = build_sftp_command(&host, &transfer_id)?;
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command.spawn().map_err(|err| {
        cleanup_temp_paths(&temp_paths);
        SftpError::Operation(err.to_string()).to_string()
    })?;

    if let Some(stdin) = child.stdin.take() {
        if let Err(err) = write_batch_then_close(stdin, batch.as_bytes()) {
            let _ = child.kill();
            cleanup_temp_paths(&temp_paths);
            return Err(SftpError::Operation(err).to_string());
        }
    }

    let child = Arc::new(Mutex::new(Some(child)));
    {
        let mut transfers = state.transfers.lock().map_err(|_| SftpError::Locked.to_string())?;
        transfers.insert(
            transfer_id.clone(),
            TransferHandle {
                child: Arc::clone(&child),
                temp_paths: temp_paths.clone(),
            },
        );
    }

    emit_transfer_event(&app, &transfer_id, "started", None);

    let app_clone = app.clone();
    let state_arc = Arc::clone(state.inner());
    let transfer_for_thread = transfer_id.clone();
    thread::spawn(move || {
        monitor_transfer(app_clone, state_arc, transfer_for_thread, child, temp_paths, label)
    });

    Ok(SftpTransferStartResponse { transfer_id })
}

fn monitor_transfer(
    app: AppHandle,
    state: Arc<SftpState>,
    transfer_id: String,
    child: Arc<Mutex<Option<Child>>>,
    temp_paths: Vec<PathBuf>,
    _label: &'static str,
) {
    // We hold the child for the whole transfer; if `sftp_cancel` is called
    // it takes the child via `child.lock().take()` and kills it.
    let mut owned = match child.lock() {
        Ok(mut guard) => match guard.take() {
            Some(c) => c,
            None => return,
        },
        Err(_) => return,
    };

    let result = owned.wait();
    let stderr = read_child_stderr(&mut owned);
    let stdout = drain_remaining_stdout(&mut owned);
    cleanup_temp_paths(&temp_paths);
    if let Ok(mut transfers) = state.transfers.lock() {
        transfers.remove(&transfer_id);
    }

    match result {
        Ok(status) if status.success() => {
            emit_transfer_event(&app, &transfer_id, "done", None);
        }
        Ok(status) => {
            let combined = format!("{stderr}\n{stdout}");
            let message = if status.code().is_some() {
                user_safe_ssh_error(combined.trim(), &[])
            } else {
                "sftp was cancelled".to_string()
            };
            emit_transfer_event(&app, &transfer_id, "error", Some(message));
        }
        Err(err) => {
            emit_transfer_event(
                &app,
                &transfer_id,
                "error",
                Some(SftpError::Operation(err.to_string()).to_string()),
            );
        }
    }
}

fn drain_remaining_stdout(child: &mut Child) -> String {
    let mut output = String::new();
    if let Some(mut stdout) = child.stdout.take() {
        let _ = stdout.read_to_string(&mut output);
    }
    output
}

fn emit_transfer_event(
    app: &AppHandle,
    transfer_id: &str,
    state: &'static str,
    message: Option<String>,
) {
    let _ = app.emit(
        "sftp://transfer",
        SftpTransferEvent {
            transfer_id: transfer_id.to_string(),
            state,
            message,
        },
    );
}

fn write_batch_then_close(mut stdin: ChildStdin, batch: &[u8]) -> Result<(), String> {
    stdin.write_all(batch).map_err(|err| err.to_string())?;
    drop(stdin);
    Ok(())
}

fn run_sftp_batch(host: &SftpHostArgs, label: &str, batch: &[u8]) -> Result<String, String> {
    let session_id = format!("sftp-{label}");
    let (mut command, temp_paths) = build_sftp_command(host, &session_id)?;
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command.spawn().map_err(|err| {
        cleanup_temp_paths(&temp_paths);
        SftpError::Operation(err.to_string()).to_string()
    })?;

    if let Some(stdin) = child.stdin.take() {
        if let Err(err) = write_batch_then_close(stdin, batch) {
            let _ = child.kill();
            cleanup_temp_paths(&temp_paths);
            return Err(SftpError::Operation(err).to_string());
        }
    }

    let mut stdout = String::new();
    if let Some(mut pipe) = child.stdout.take() {
        let _ = pipe.read_to_string(&mut stdout);
    }
    let stderr = read_child_stderr(&mut child);

    let status = child.wait().map_err(|err| {
        cleanup_temp_paths(&temp_paths);
        SftpError::Operation(err.to_string()).to_string()
    })?;
    cleanup_temp_paths(&temp_paths);

    if !status.success() {
        let combined = format!("{stderr}\n{stdout}");
        return Err(SftpError::Operation(user_safe_ssh_error(combined.trim(), &[])).to_string());
    }
    let _ = user_safe_ssh_output(&stdout, &[]); // touch helper to silence dead-code warnings on this path

    Ok(stdout)
}

fn build_sftp_command(
    host: &SftpHostArgs,
    session_id: &str,
) -> Result<(ProcessCommand, Vec<PathBuf>), String> {
    let host_value = host.host.trim();
    if host_value.is_empty() {
        return Err(SftpError::Operation("host is required".to_string()).to_string());
    }
    if host.private_key_pem.is_empty() {
        return Err(
            SftpError::Operation("attached SSH identity is required".to_string()).to_string(),
        );
    }

    let mut key_bytes = host.private_key_pem.clone();
    let rsa = is_rsa_private_key(&key_bytes);
    let key_path = write_temp_ssh_file(session_id, "sftp-key", &key_bytes);
    key_bytes.fill(0);
    let key_path = key_path?;
    let config_path = match write_temp_ssh_file(session_id, "sftp-config", &[]) {
        Ok(path) => path,
        Err(err) => {
            cleanup_temp_paths(std::slice::from_ref(&key_path));
            return Err(err);
        }
    };
    let temp_paths = vec![key_path.clone(), config_path.clone()];

    let mut command = ProcessCommand::new("sftp");
    command
        .arg("-F")
        .arg(&config_path)
        .arg("-i")
        .arg(&key_path)
        .arg("-b")
        .arg("-")
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
        .arg("ConnectTimeout=15")
        .arg("-P")
        .arg(host.port.max(1).to_string());
    if rsa {
        rsa_key_compat_process_options(&mut command);
    }
    command.arg(destination(host_value, &host.username)?);

    Ok((command, temp_paths))
}

fn require_transfer_id(transfer_id: String) -> Result<String, String> {
    let trimmed = transfer_id.trim();
    if trimmed.is_empty() {
        return Err(SftpError::Operation("transfer id is required".to_string()).to_string());
    }
    Ok(trimmed.to_string())
}

/// Quote a remote path for `sftp -b` so spaces and shell metacharacters survive.
fn quote_remote(path: &str) -> String {
    format!("\"{}\"", path.replace('"', "\\\""))
}

/// Quote a local path the same way; sftp uses the same parser for both sides.
fn quote_local(path: &str) -> String {
    quote_remote(path)
}

fn clean_remote_path(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        ".".to_string()
    } else {
        trimmed.to_string()
    }
}

/// Pluck the path out of OpenSSH `sftp` `pwd` output. The line looks like
/// `Remote working directory: /home/ubuntu` (modulo translations and casing).
pub(crate) fn extract_pwd_path(stdout: &str) -> Option<String> {
    for line in stdout.lines() {
        let trimmed = line.trim_end_matches('\r').trim();
        if trimmed.is_empty() || trimmed.starts_with("sftp>") {
            continue;
        }
        if let Some(rest) = trimmed.split_once(':') {
            let candidate = rest.1.trim();
            if candidate.starts_with('/') {
                return Some(candidate.to_string());
            }
        }
        if trimmed.starts_with('/') {
            // Some servers print just the absolute path with no prefix.
            return Some(trimmed.to_string());
        }
    }
    None
}

// ---------- Local filesystem (for the dual-pane left side) ----------

#[tauri::command]
pub fn sftp_local_list(request: LocalListRequest) -> Result<LocalListResponse, String> {
    let raw_path = request.path.trim();
    let target = if raw_path.is_empty() {
        home_dir_or_temp()
    } else {
        PathBuf::from(raw_path)
    };
    let canonical = match fs::canonicalize(&target) {
        Ok(value) => value,
        Err(_) => target.clone(),
    };
    let entries = read_local_dir(&canonical)?;
    Ok(LocalListResponse {
        path: canonical.to_string_lossy().into_owned(),
        entries,
    })
}

#[tauri::command]
pub fn sftp_local_home() -> Result<LocalHomeResponse, String> {
    let home = home_dir_or_temp();
    Ok(LocalHomeResponse {
        path: home.to_string_lossy().into_owned(),
    })
}

fn read_local_dir(path: &Path) -> Result<Vec<SftpEntry>, String> {
    let read = fs::read_dir(path)
        .map_err(|err| SftpError::Operation(format!("{}: {}", path.display(), err)).to_string())?;
    let mut entries = Vec::new();
    for entry in read.flatten() {
        let Ok(metadata) = entry.metadata() else { continue };
        let kind = if metadata.is_dir() {
            "dir"
        } else if metadata.file_type().is_symlink() {
            "symlink"
        } else if metadata.is_file() {
            "file"
        } else {
            "other"
        };
        let modified = metadata
            .modified()
            .ok()
            .and_then(|m| m.duration_since(UNIX_EPOCH).ok())
            .map(|d| format_unix_timestamp(d.as_secs()))
            .unwrap_or_default();
        entries.push(SftpEntry {
            name: entry.file_name().to_string_lossy().into_owned(),
            kind: kind.to_string(),
            size: if metadata.is_dir() { 0 } else { metadata.len() },
            modified,
            permissions: String::new(),
        });
    }
    entries.sort_by(|a, b| match (a.kind.as_str(), b.kind.as_str()) {
        ("dir", "dir") | ("file", "file") => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        ("dir", _) => std::cmp::Ordering::Less,
        (_, "dir") => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    Ok(entries)
}

fn home_dir_or_temp() -> PathBuf {
    if let Some(home) = env::var_os("HOME") {
        return PathBuf::from(home);
    }
    if let Some(profile) = env::var_os("USERPROFILE") {
        return PathBuf::from(profile);
    }
    env::temp_dir()
}

fn format_unix_timestamp(seconds: u64) -> String {
    // Minimal yyyy-mm-dd-ish display computed without chrono. We render days
    // since epoch and the seconds-of-day as HH:MM in UTC. Frontend treats it
    // as opaque text per the SFTP listing semantics.
    let days_since_epoch = seconds / 86_400;
    let secs_of_day = seconds % 86_400;
    let hours = secs_of_day / 3600;
    let minutes = (secs_of_day % 3600) / 60;
    // 1970-01-01 + days_since_epoch via the 400-year cycle.
    let mut year = 1970u64;
    let mut day = days_since_epoch as i64;
    loop {
        let leap = is_leap_year(year);
        let year_days = if leap { 366 } else { 365 };
        if day < year_days {
            break;
        }
        day -= year_days;
        year += 1;
    }
    let month_days = month_lengths(is_leap_year(year));
    let mut month = 0usize;
    for (i, len) in month_days.iter().enumerate() {
        if day < *len {
            month = i;
            break;
        }
        day -= len;
    }
    let day_of_month = (day + 1) as u64;
    format!(
        "{year:04}-{:02}-{day_of_month:02} {hours:02}:{minutes:02}",
        month + 1
    )
}

fn is_leap_year(year: u64) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

fn month_lengths(leap: bool) -> [i64; 12] {
    [
        31,
        if leap { 29 } else { 28 },
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ]
}

// ---------- Listing parser ----------

/// Parse the `ls -la` output that `sftp` emits and turn each row into a
/// typed entry. Tolerates the leading `sftp> ls -la PATH` echo line and any
/// `total <n>` summary that some servers print first.
pub(crate) fn parse_sftp_listing(output: &str) -> Vec<SftpEntry> {
    let mut entries = Vec::new();
    for line in output.lines() {
        if let Some(entry) = parse_listing_line(line) {
            entries.push(entry);
        }
    }
    entries
}

fn parse_listing_line(line: &str) -> Option<SftpEntry> {
    let trimmed = line.trim_end_matches('\r').trim_start();
    if trimmed.is_empty() {
        return None;
    }
    if trimmed.starts_with("sftp>") || trimmed.to_lowercase().starts_with("total ") {
        return None;
    }

    // ls -la collapses runs of whitespace, so we peel off the first 8 fields
    // (perms, links, owner, group, size, mon, day, time/year) and take
    // everything after the 8th field as the name. That preserves names
    // containing spaces; a plain `splitn` on `char::is_whitespace` would
    // split each run into separate empty tokens.
    let mut field = 0usize;
    let mut name_start: Option<usize> = None;
    let mut prev_was_ws = false;
    let mut chars = trimmed.char_indices();
    while let Some((_, ch)) = chars.next() {
        if ch.is_whitespace() {
            if !prev_was_ws {
                field += 1;
                if field == 8 {
                    // Skip following whitespace; name starts at the next non-ws char.
                    for (jdx, jch) in chars.by_ref() {
                        if !jch.is_whitespace() {
                            name_start = Some(jdx);
                            break;
                        }
                    }
                    break;
                }
            }
            prev_was_ws = true;
        } else {
            prev_was_ws = false;
        }
    }

    let name_start = name_start?;
    let name_str = &trimmed[name_start..];

    let mut tokens = trimmed[..name_start].split_whitespace();
    let permissions = tokens.next()?;
    let _links = tokens.next()?;
    let _owner = tokens.next()?;
    let _group = tokens.next()?;
    let size_str = tokens.next()?;
    let mon = tokens.next()?;
    let day = tokens.next()?;
    let time_or_year = tokens.next()?;
    if tokens.next().is_some() {
        // Unexpected extra field before name; bail.
        return None;
    }

    let kind = entry_kind_from_perms(permissions);
    let size = size_str.parse::<u64>().ok()?;
    let modified = format!("{mon} {day} {time_or_year}");
    let mut name = name_str.to_string();
    // Symlink entries print as "name -> target". Keep just the local name.
    if kind == "symlink" {
        if let Some(idx) = name.find(" -> ") {
            name.truncate(idx);
        }
    }
    if name == "." {
        // Frontend supplies its own current-dir indicator.
        return None;
    }

    Some(SftpEntry {
        name,
        kind: kind.to_string(),
        size,
        modified,
        permissions: permissions.to_string(),
    })
}

fn entry_kind_from_perms(perms: &str) -> &'static str {
    let Some(first) = perms.chars().next() else {
        return "other";
    };
    match first {
        'd' => "dir",
        '-' => "file",
        'l' => "symlink",
        _ => "other",
    }
}

#[cfg(test)]
mod tests {
    use super::{extract_pwd_path, parse_sftp_listing, quote_remote};

    #[test]
    fn extracts_pwd_path_from_openssh_output() {
        let raw = "sftp> pwd\nRemote working directory: /home/ubuntu\n";
        assert_eq!(extract_pwd_path(raw).as_deref(), Some("/home/ubuntu"));
    }

    #[test]
    fn extracts_bare_pwd_path() {
        let raw = "sftp> pwd\n/srv/app\n";
        assert_eq!(extract_pwd_path(raw).as_deref(), Some("/srv/app"));
    }

    #[test]
    fn extract_pwd_path_returns_none_for_garbage() {
        assert_eq!(extract_pwd_path("sftp> pwd\n"), None);
    }


    #[test]
    fn parses_ls_la_output() {
        let output = "sftp> ls -la /home/deploy\n\
            total 16\n\
            drwxr-xr-x   4 deploy deploy 4096 May  3 12:34 .\n\
            drwxr-xr-x   3 root   root   4096 Jan 14 10:00 ..\n\
            -rw-r--r--   1 deploy deploy 1024 May  3 12:34 deploy.sh\n\
            lrwxrwxrwx   1 deploy deploy   12 Apr 22 09:11 logs -> /var/log/app\n";

        let entries = parse_sftp_listing(output);
        let names: Vec<_> = entries.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, vec!["..", "deploy.sh", "logs"]);

        let logs = entries.iter().find(|e| e.name == "logs").unwrap();
        assert_eq!(logs.kind, "symlink");

        let deploy = entries.iter().find(|e| e.name == "deploy.sh").unwrap();
        assert_eq!(deploy.kind, "file");
        assert_eq!(deploy.size, 1024);
        assert_eq!(deploy.permissions, "-rw-r--r--");
        assert!(deploy.modified.contains("May"));
    }

    #[test]
    fn ignores_dot_entry_keeps_dotdot() {
        let output = "drwxr-xr-x   4 a a 4096 May  3 12:34 .\n\
                      drwxr-xr-x   3 a a 4096 May  3 12:34 ..\n";
        let entries = parse_sftp_listing(output);
        let names: Vec<_> = entries.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, vec![".."]);
    }

    #[test]
    fn quotes_remote_paths() {
        assert_eq!(quote_remote("/srv/app"), "\"/srv/app\"");
        assert_eq!(quote_remote("with space"), "\"with space\"");
        assert_eq!(
            quote_remote("with \"quote\""),
            "\"with \\\"quote\\\"\""
        );
    }
}
