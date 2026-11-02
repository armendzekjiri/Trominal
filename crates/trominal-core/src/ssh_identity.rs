//! Getting a decrypted private key to the system `ssh` without writing it
//! to disk.
//!
//! On Unix every SSH process (terminal, tunnel, SFTP batch, key test) gets
//! its own short-lived `ssh-agent` bound to a socket inside a fresh `0700`
//! directory. The key is handed to `ssh-add -` over a pipe, so the
//! plaintext only ever exists in this process's (zeroized) buffers, the
//! pipe, and the agent's memory. `ssh` is pointed at the agent with
//! `IdentityAgent` and at the matching *public* key with `IdentityFile`, and
//! the agent is killed and its directory removed when the session ends.
//! Keys are added with a lifetime (`ssh-add -t`) so even an agent orphaned
//! by a crash forgets the key on its own.
//!
//! Passphrase-protected keys are supported when the passphrase is known:
//! `ssh-add` is forced to use an askpass program (normally the Trominal
//! binary itself, see `askpass` in the client) which fetches the passphrase
//! from a one-shot Unix socket in the same private directory. Without a
//! passphrase an encrypted key is rejected with a clear error instead of
//! hanging on a prompt.
//!
//! Windows has no per-process agent: OpenSSH for Windows runs `ssh-agent` as
//! a system service that persists added keys in the registry, which would
//! be worse than a short-lived file. There the key is written to a file in a
//! fresh per-session directory whose ACL is reset to the current user only
//! (`icacls /inheritance:r /grant:r`) before anything is written, the file
//! is deleted after [`KEY_LIFETIME`] or when the session ends (whichever
//! comes first), and stale files are swept on the next start.

use crate::secret::SecretBytes;
use base64::Engine as _;
use std::env;
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use thiserror::Error;

/// How long a loaded key stays usable. Authentication happens right after
/// connect; the agent (or, on Windows, the key file) forgets the key after
/// this even if the session is never closed cleanly.
pub const KEY_LIFETIME: Duration = Duration::from_secs(300);

/// Prefix of every private directory this module creates.
pub const DIR_PREFIX: &str = "trm-ssh-";

/// Env var that tells the Trominal binary to act as `SSH_ASKPASS`.
pub const ASKPASS_ENV: &str = "TROMINAL_ASKPASS";
/// Env var carrying the askpass socket path (Unix only).
pub const ASKPASS_SOCKET_ENV: &str = "TROMINAL_ASKPASS_SOCKET";

const AGENT_SOCKET: &str = "agent.sock";
const ASKPASS_SOCKET: &str = "askpass.sock";
const PUBLIC_KEY_FILE: &str = "identity.pub";
#[cfg(windows)]
const PRIVATE_KEY_FILE: &str = "identity";

#[derive(Debug, Error)]
pub enum IdentityError {
    #[error("could not prepare a private SSH directory: {0}")]
    Directory(String),
    #[error("could not start ssh-agent: {0}")]
    Agent(String),
    #[error(
        "this SSH key is protected by a passphrase; save the passphrase with the host's credential to use it"
    )]
    PassphraseRequired,
    #[error("the SSH key could not be loaded (wrong passphrase or unsupported key format)")]
    KeyRejected,
    #[error("SSH key handling failed: {0}")]
    Io(String),
}

// ---------- Private directory ----------

/// A directory created fresh for one SSH process, readable only by the
/// current user, and removed (with everything in it) on drop.
#[derive(Debug)]
pub struct PrivateDir {
    path: PathBuf,
}

impl PrivateDir {
    /// Create a new private directory under [`runtime_base_dir`].
    pub fn create() -> Result<Self, IdentityError> {
        Self::create_in(&runtime_base_dir())
    }

    /// Create a new private directory under `base`. The directory is
    /// created with `create_dir` (which fails if anything, including a
    /// symlink, already has that name), so on success it is new and ours.
    pub fn create_in(base: &Path) -> Result<Self, IdentityError> {
        let mut last_error = None;
        for _ in 0..16 {
            let path = base.join(unique_name());
            match create_private_dir(&path) {
                Ok(()) => {
                    let dir = Self { path };
                    restrict_to_current_user(&dir.path)?;
                    return Ok(dir);
                }
                Err(err) if err.kind() == io::ErrorKind::AlreadyExists => last_error = Some(err),
                Err(err) => return Err(IdentityError::Directory(err.to_string())),
            }
        }
        Err(IdentityError::Directory(
            last_error.map_or_else(|| "name collision".to_string(), |err| err.to_string()),
        ))
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Write a new file (fails if it exists), mode `0600` on Unix.
    pub fn write_file(&self, name: &str, contents: &[u8]) -> Result<PathBuf, IdentityError> {
        let path = self.path.join(name);
        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options
            .open(&path)
            .map_err(|err| IdentityError::Io(err.to_string()))?;
        if let Err(err) = file.write_all(contents).and_then(|()| file.flush()) {
            drop(file);
            let _ = fs::remove_file(&path);
            return Err(IdentityError::Io(err.to_string()));
        }
        Ok(path)
    }
}

impl Drop for PrivateDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

/// Per-user location for the private directories: `$XDG_RUNTIME_DIR` (a
/// per-user tmpfs on most Linux desktops) when set, otherwise the per-user
/// temp directory (macOS `/var/folders/...`, Windows `%TEMP%`).
pub fn runtime_base_dir() -> PathBuf {
    #[cfg(all(unix, not(target_os = "macos")))]
    if let Some(dir) = env::var_os("XDG_RUNTIME_DIR").map(PathBuf::from) {
        if dir.is_absolute() && dir.is_dir() {
            return dir;
        }
    }
    env::temp_dir()
}

/// Remove leftovers from sessions that ended without cleanup (crash, kill).
/// Anything older than [`KEY_LIFETIME`] is past the point where a live
/// session could still need it, so it's safe to delete even if another
/// Trominal instance created it.
pub fn sweep_stale_dirs(base: &Path) {
    sweep_stale_dirs_older_than(base, KEY_LIFETIME + Duration::from_secs(60));
}

fn sweep_stale_dirs_older_than(base: &Path, max_age: Duration) {
    let Ok(entries) = fs::read_dir(base) else {
        return;
    };
    let now = SystemTime::now();
    for entry in entries.flatten() {
        let name = entry.file_name();
        if !name.to_string_lossy().starts_with(DIR_PREFIX) {
            continue;
        }
        let Ok(metadata) = entry.path().symlink_metadata() else {
            continue;
        };
        if !metadata.is_dir() {
            continue;
        }
        let old_enough = metadata
            .modified()
            .ok()
            .and_then(|modified| now.duration_since(modified).ok())
            .is_some_and(|age| age >= max_age);
        if old_enough {
            let _ = fs::remove_dir_all(entry.path());
        }
    }
}

fn unique_name() -> String {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    let count = COUNTER.fetch_add(1, Ordering::Relaxed);
    // Short on purpose: Unix socket paths are limited to ~104 bytes.
    let mixed = (nanos as u64) ^ (u64::from(std::process::id()) << 32) ^ count.rotate_left(17);
    format!("{DIR_PREFIX}{mixed:016x}")
}

fn create_private_dir(path: &Path) -> io::Result<()> {
    let mut builder = fs::DirBuilder::new();
    #[cfg(unix)]
    {
        use std::os::unix::fs::DirBuilderExt;
        builder.mode(0o700);
    }
    builder.create(path)
}

#[cfg(unix)]
fn restrict_to_current_user(path: &Path) -> Result<(), IdentityError> {
    use std::os::unix::fs::PermissionsExt;
    // DirBuilder already used 0700 (minus umask); make it exact.
    fs::set_permissions(path, fs::Permissions::from_mode(0o700))
        .map_err(|err| IdentityError::Directory(err.to_string()))
}

#[cfg(windows)]
fn restrict_to_current_user(path: &Path) -> Result<(), IdentityError> {
    // Drop inherited ACEs and grant only the current user full control, so
    // files created inside inherit a user-only ACL. Failing here is fatal:
    // the caller must not fall back to an unrestricted directory.
    let user = match (env::var("USERDOMAIN"), env::var("USERNAME")) {
        (Ok(domain), Ok(name)) if !domain.is_empty() && !name.is_empty() => {
            format!("{domain}\\{name}")
        }
        (_, Ok(name)) if !name.is_empty() => name,
        _ => {
            return Err(IdentityError::Directory(
                "cannot determine the current Windows user".to_string(),
            ))
        }
    };
    let status = Command::new("icacls")
        .arg(path)
        .arg("/inheritance:r")
        .arg("/grant:r")
        .arg(format!("{user}:(OI)(CI)F"))
        .arg("/q")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(|err| IdentityError::Directory(format!("icacls: {err}")))?;
    if !status.success() {
        return Err(IdentityError::Directory(
            "could not restrict the SSH key directory to the current user".to_string(),
        ));
    }
    Ok(())
}

// ---------- Key inspection ----------

/// True when the key needs a passphrase: an OpenSSH key whose cipher isn't
/// `none`, a legacy PEM with `Proc-Type: 4,ENCRYPTED`, or PKCS#8
/// `ENCRYPTED PRIVATE KEY`. Only the unencrypted header of an OpenSSH key
/// is decoded, so no private material is copied.
pub fn private_key_is_encrypted(pem: &[u8]) -> bool {
    if contains(pem, b"-----BEGIN ENCRYPTED PRIVATE KEY-----")
        || contains(pem, b"Proc-Type: 4,ENCRYPTED")
    {
        return true;
    }
    const OPENSSH_BEGIN: &[u8] = b"-----BEGIN OPENSSH PRIVATE KEY-----";
    let Some(start) = find(pem, OPENSSH_BEGIN) else {
        return false;
    };
    // magic "openssh-key-v1\0" (15) + u32 length + cipher name: 64 bytes
    // of header is plenty, i.e. the first 88 base64 characters.
    let mut header: Vec<u8> = pem[start + OPENSSH_BEGIN.len()..]
        .iter()
        .copied()
        .take_while(|byte| *byte != b'-')
        .filter(|byte| !byte.is_ascii_whitespace())
        .take(88)
        .collect();
    header.truncate(header.len() - header.len() % 4);
    let Ok(decoded) = base64::engine::general_purpose::STANDARD.decode(&header) else {
        return false;
    };
    const MAGIC: &[u8] = b"openssh-key-v1\0";
    if decoded.len() < MAGIC.len() + 4 || &decoded[..MAGIC.len()] != MAGIC {
        return false;
    }
    let len_bytes: [u8; 4] = decoded[MAGIC.len()..MAGIC.len() + 4]
        .try_into()
        .unwrap_or([0; 4]);
    let len = u32::from_be_bytes(len_bytes) as usize;
    let name_start = MAGIC.len() + 4;
    match decoded.get(name_start..name_start + len) {
        Some(cipher) => cipher != b"none",
        None => true,
    }
}

/// True for PEM RSA keys (PKCS#1 or PKCS#8), which need `+ssh-rsa`
/// compatibility options with some servers. Works on bytes, no copies.
pub fn is_rsa_private_key(pem: &[u8]) -> bool {
    contains(pem, b"-----BEGIN RSA PRIVATE KEY-----")
        || contains(pem, b"-----BEGIN PRIVATE KEY-----")
}

fn find(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}

fn contains(haystack: &[u8], needle: &[u8]) -> bool {
    find(haystack, needle).is_some()
}

// ---------- Loaded identity ----------

/// A private key made available to one `ssh` process. Dropping it unloads
/// the key (kills the agent / deletes the Windows key file).
#[derive(Debug)]
pub struct LoadedIdentity {
    #[cfg(unix)]
    agent: Agent,
    identity_file: PathBuf,
    #[cfg(windows)]
    _key_file_timer: KeyFileTimer,
}

/// Options for [`LoadedIdentity::load`].
#[derive(Debug, Default, Clone)]
pub struct LoadOptions {
    /// Program `ssh-add` runs to obtain a passphrase. Should print the
    /// passphrase when `TROMINAL_ASKPASS_SOCKET` is set (see the client's
    /// askpass mode). `None` disables passphrase support.
    pub askpass_program: Option<PathBuf>,
    /// Name or path of the OpenSSH tools (`ssh-agent`, `ssh-add`) directory
    /// override; `None` uses `PATH`.
    pub tools_dir: Option<PathBuf>,
}

impl LoadedIdentity {
    /// Make `key` available to `ssh` via files/sockets inside `dir`.
    pub fn load(
        dir: &PrivateDir,
        key: &SecretBytes,
        passphrase: Option<&SecretBytes>,
        options: &LoadOptions,
    ) -> Result<Self, IdentityError> {
        if key.is_empty() {
            return Err(IdentityError::KeyRejected);
        }
        let passphrase = passphrase.filter(|value| !value.is_empty());
        if passphrase.is_none() && private_key_is_encrypted(key.expose()) {
            return Err(IdentityError::PassphraseRequired);
        }
        Self::load_platform(dir, key, passphrase, options)
    }

    #[cfg(unix)]
    fn load_platform(
        dir: &PrivateDir,
        key: &SecretBytes,
        passphrase: Option<&SecretBytes>,
        options: &LoadOptions,
    ) -> Result<Self, IdentityError> {
        let agent = Agent::start(dir, options)?;
        agent.add_key(dir, key, passphrase, options)?;
        let public_key = agent.public_keys(options)?;
        let identity_file = dir.write_file(PUBLIC_KEY_FILE, public_key.as_bytes())?;
        Ok(Self {
            agent,
            identity_file,
        })
    }

    #[cfg(windows)]
    fn load_platform(
        dir: &PrivateDir,
        key: &SecretBytes,
        _passphrase: Option<&SecretBytes>,
        _options: &LoadOptions,
    ) -> Result<Self, IdentityError> {
        // Documented fallback: see the module docs. The directory ACL was
        // already reset to the current user only by PrivateDir::create.
        let identity_file = dir.write_file(PRIVATE_KEY_FILE, key.expose())?;
        let timer = KeyFileTimer::start(identity_file.clone());
        Ok(Self {
            identity_file,
            _key_file_timer: timer,
        })
    }

    /// The `ssh` options that select this identity and nothing else.
    pub fn ssh_options(&self) -> Vec<String> {
        let mut args = vec![
            "-i".to_string(),
            self.identity_file.to_string_lossy().into_owned(),
            "-o".to_string(),
            "IdentitiesOnly=yes".to_string(),
            "-o".to_string(),
        ];
        #[cfg(unix)]
        args.push(format!(
            "IdentityAgent={}",
            ssh_option_path(self.agent.socket())
        ));
        #[cfg(windows)]
        args.push("IdentityAgent=none".to_string());
        args
    }

    /// Path given to `ssh -i`: the public key on Unix (the private half is
    /// in the agent), the restricted key file on Windows.
    pub fn identity_file(&self) -> &Path {
        &self.identity_file
    }

    /// Agent socket (Unix only).
    #[cfg(unix)]
    pub fn agent_socket(&self) -> &Path {
        self.agent.socket()
    }
}

/// Format a path as an `ssh -o Key=value` value: `%` is doubled (ssh
/// percent-expands these options), backslashes become `/` on Windows, and
/// the value is double-quoted when it contains whitespace.
pub fn ssh_option_path(path: &Path) -> String {
    let mut value = path.to_string_lossy().replace('%', "%%");
    if cfg!(windows) {
        value = value.replace('\\', "/");
    }
    if value.chars().any(char::is_whitespace) {
        format!("\"{value}\"")
    } else {
        value
    }
}

// ---------- Unix: private ssh-agent ----------

#[cfg(unix)]
#[derive(Debug)]
struct Agent {
    child: Child,
    socket: PathBuf,
}

#[cfg(unix)]
impl Agent {
    fn start(dir: &PrivateDir, options: &LoadOptions) -> Result<Self, IdentityError> {
        let socket = dir.path().join(AGENT_SOCKET);
        let mut child = tool(options, "ssh-agent")
            // -D: stay in the foreground as our child so we own its lifetime.
            .arg("-D")
            .arg("-a")
            .arg(&socket)
            .env_remove("SSH_AUTH_SOCK")
            .env_remove("SSH_AGENT_PID")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|err| IdentityError::Agent(err.to_string()))?;

        let deadline = std::time::Instant::now() + Duration::from_secs(5);
        loop {
            if socket.exists() {
                return Ok(Self { child, socket });
            }
            if let Ok(Some(status)) = child.try_wait() {
                return Err(IdentityError::Agent(format!("exited early ({status})")));
            }
            if std::time::Instant::now() >= deadline {
                let _ = child.kill();
                let _ = child.wait();
                return Err(IdentityError::Agent("timed out".to_string()));
            }
            thread::sleep(Duration::from_millis(10));
        }
    }

    fn socket(&self) -> &Path {
        &self.socket
    }

    fn add_key(
        &self,
        dir: &PrivateDir,
        key: &SecretBytes,
        passphrase: Option<&SecretBytes>,
        options: &LoadOptions,
    ) -> Result<(), IdentityError> {
        let askpass = match passphrase {
            Some(passphrase) => Some(AskpassServer::start(dir, passphrase)?),
            None => None,
        };
        let mut command = tool(options, "ssh-add");
        command
            .arg("-q")
            .arg("-t")
            .arg(KEY_LIFETIME.as_secs().to_string())
            .arg("-")
            .env("SSH_AUTH_SOCK", &self.socket)
            .env_remove("SSH_AGENT_PID")
            // Never fall back to a terminal prompt: either our askpass
            // answers or loading fails.
            .env("SSH_ASKPASS_REQUIRE", "force")
            .env(ASKPASS_ENV, "1")
            .env_remove(ASKPASS_SOCKET_ENV)
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        match (&askpass, &options.askpass_program) {
            (Some(server), Some(program)) => {
                command
                    .env("SSH_ASKPASS", program)
                    .env(ASKPASS_SOCKET_ENV, server.socket());
            }
            (Some(_), None) => return Err(IdentityError::PassphraseRequired),
            (None, _) => {
                command.env("SSH_ASKPASS", "false");
            }
        }

        let mut child = command
            .spawn()
            .map_err(|err| IdentityError::Agent(format!("ssh-add: {err}")))?;
        if let Some(mut stdin) = child.stdin.take() {
            let written = stdin.write_all(key.expose());
            drop(stdin);
            if let Err(err) = written {
                let _ = child.kill();
                let _ = child.wait();
                return Err(IdentityError::Io(err.to_string()));
            }
        }
        let status = wait_with_timeout(&mut child, Duration::from_secs(30))
            .map_err(|err| IdentityError::Agent(format!("ssh-add: {err}")))?;
        drop(askpass);
        if status {
            Ok(())
        } else {
            Err(IdentityError::KeyRejected)
        }
    }

    /// The public key(s) held by the agent, in `authorized_keys` format.
    fn public_keys(&self, options: &LoadOptions) -> Result<String, IdentityError> {
        let output = tool(options, "ssh-add")
            .arg("-L")
            .env("SSH_AUTH_SOCK", &self.socket)
            .stdin(Stdio::null())
            .stderr(Stdio::null())
            .output()
            .map_err(|err| IdentityError::Agent(format!("ssh-add -L: {err}")))?;
        let listing = String::from_utf8_lossy(&output.stdout).into_owned();
        if !output.status.success() || listing.trim().is_empty() {
            return Err(IdentityError::KeyRejected);
        }
        Ok(listing)
    }
}

#[cfg(unix)]
impl Drop for Agent {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
        let _ = fs::remove_file(&self.socket);
    }
}

#[cfg(unix)]
fn tool(options: &LoadOptions, name: &str) -> Command {
    match &options.tools_dir {
        Some(dir) => Command::new(dir.join(name)),
        None => Command::new(name),
    }
}

#[cfg(unix)]
fn wait_with_timeout(child: &mut Child, timeout: Duration) -> io::Result<bool> {
    let deadline = std::time::Instant::now() + timeout;
    loop {
        if let Some(status) = child.try_wait()? {
            return Ok(status.success());
        }
        if std::time::Instant::now() >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            return Ok(false);
        }
        thread::sleep(Duration::from_millis(10));
    }
}

/// Serves the passphrase exactly once to the askpass helper over a Unix
/// socket inside the private directory, then stops listening.
#[cfg(unix)]
struct AskpassServer {
    socket: PathBuf,
    stop: std::sync::Arc<std::sync::atomic::AtomicBool>,
    thread: Option<thread::JoinHandle<()>>,
}

#[cfg(unix)]
impl AskpassServer {
    fn start(dir: &PrivateDir, passphrase: &SecretBytes) -> Result<Self, IdentityError> {
        use std::os::unix::net::UnixListener;
        use std::sync::atomic::AtomicBool;
        use std::sync::Arc;

        let socket = dir.path().join(ASKPASS_SOCKET);
        let listener =
            UnixListener::bind(&socket).map_err(|err| IdentityError::Io(err.to_string()))?;
        listener
            .set_nonblocking(true)
            .map_err(|err| IdentityError::Io(err.to_string()))?;
        let stop = Arc::new(AtomicBool::new(false));
        let stop_flag = Arc::clone(&stop);
        let secret = zeroize::Zeroizing::new(passphrase.expose().to_vec());
        let thread = thread::spawn(move || {
            while !stop_flag.load(Ordering::Relaxed) {
                match listener.accept() {
                    Ok((mut stream, _)) => {
                        let _ = stream.set_nonblocking(false);
                        let _ = stream.write_all(&secret);
                        // One answer only; a retry after a wrong passphrase
                        // gets nothing and ssh-add gives up.
                        break;
                    }
                    Err(err) if err.kind() == io::ErrorKind::WouldBlock => {
                        thread::sleep(Duration::from_millis(10));
                    }
                    Err(_) => break,
                }
            }
            drop(secret);
        });
        Ok(Self {
            socket,
            stop,
            thread: Some(thread),
        })
    }

    fn socket(&self) -> &Path {
        &self.socket
    }
}

#[cfg(unix)]
impl Drop for AskpassServer {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
        let _ = fs::remove_file(&self.socket);
    }
}

/// Askpass side: fetch the passphrase from the socket named in
/// `TROMINAL_ASKPASS_SOCKET` and write it (plus a newline) to `out`.
/// Returns false when there is nothing to answer with.
#[cfg(unix)]
pub fn answer_askpass(out: &mut impl Write) -> bool {
    match env::var_os(ASKPASS_SOCKET_ENV) {
        Some(socket) => answer_askpass_from(Path::new(&socket), out),
        None => false,
    }
}

#[cfg(unix)]
fn answer_askpass_from(socket: &Path, out: &mut impl Write) -> bool {
    use std::io::Read;
    use std::os::unix::net::UnixStream;

    let Ok(mut stream) = UnixStream::connect(socket) else {
        return false;
    };
    let mut secret = zeroize::Zeroizing::new(Vec::new());
    if stream.read_to_end(&mut secret).is_err() || secret.is_empty() {
        return false;
    }
    out.write_all(&secret)
        .and_then(|()| out.write_all(b"\n"))
        .and_then(|()| out.flush())
        .is_ok()
}

#[cfg(windows)]
pub fn answer_askpass(_out: &mut impl Write) -> bool {
    false
}

// ---------- Windows: key file timer ----------

/// Deletes the Windows fallback key file after [`KEY_LIFETIME`] even if
/// the session stays open (ssh reads it once, at authentication).
#[cfg(windows)]
#[derive(Debug)]
struct KeyFileTimer {
    cancel: std::sync::mpsc::Sender<()>,
}

#[cfg(windows)]
impl KeyFileTimer {
    fn start(path: PathBuf) -> Self {
        let (cancel, cancelled) = std::sync::mpsc::channel::<()>();
        thread::spawn(move || {
            let _ = cancelled.recv_timeout(KEY_LIFETIME);
            let _ = fs::remove_file(&path);
        });
        Self { cancel }
    }
}

#[cfg(windows)]
impl Drop for KeyFileTimer {
    fn drop(&mut self) {
        let _ = self.cancel.send(());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const OPENSSH_UNENCRYPTED: &str = "-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACBNjCg9mc6v2JgoKd3yz5F0hGf2VGbV2G4/0UzA1kKvjwAAAJhm0Y4cZtGO
-----END OPENSSH PRIVATE KEY-----
";
    const OPENSSH_ENCRYPTED: &str = "-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAACmFlczI1Ni1jdHIAAAAGYmNyeXB0AAAAGAAAABAOfjCG4c
-----END OPENSSH PRIVATE KEY-----
";

    #[test]
    fn detects_encrypted_private_keys() {
        assert!(!private_key_is_encrypted(OPENSSH_UNENCRYPTED.as_bytes()));
        assert!(private_key_is_encrypted(OPENSSH_ENCRYPTED.as_bytes()));
        assert!(private_key_is_encrypted(
            b"-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-128-CBC,00\n"
        ));
        assert!(private_key_is_encrypted(
            b"-----BEGIN ENCRYPTED PRIVATE KEY-----\nMIIF\n-----END ENCRYPTED PRIVATE KEY-----"
        ));
        assert!(!private_key_is_encrypted(
            b"-----BEGIN RSA PRIVATE KEY-----\nMIIE\n-----END RSA PRIVATE KEY-----"
        ));
        assert!(!private_key_is_encrypted(b"garbage"));
    }

    #[test]
    fn detects_rsa_private_key_pem_headers() {
        assert!(is_rsa_private_key(
            b"-----BEGIN RSA PRIVATE KEY-----\nkey\n-----END RSA PRIVATE KEY-----"
        ));
        assert!(is_rsa_private_key(
            b"-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----"
        ));
        assert!(!is_rsa_private_key(OPENSSH_UNENCRYPTED.as_bytes()));
    }

    #[test]
    fn private_dir_is_owner_only_and_removed_on_drop() {
        let dir = PrivateDir::create().expect("private dir");
        let path = dir.path().to_path_buf();
        assert!(path
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with(DIR_PREFIX));
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = fs::metadata(&path).unwrap().permissions().mode() & 0o777;
            assert_eq!(mode, 0o700);
            let file = dir.write_file("probe", b"public").unwrap();
            let file_mode = fs::metadata(&file).unwrap().permissions().mode() & 0o777;
            assert_eq!(file_mode, 0o600);
        }
        assert!(dir.write_file("probe2", b"x").is_ok());
        assert!(dir.write_file("probe2", b"x").is_err(), "no overwrite");
        drop(dir);
        assert!(!path.exists());
    }

    #[test]
    fn private_dirs_never_collide() {
        let a = PrivateDir::create().unwrap();
        let b = PrivateDir::create().unwrap();
        assert_ne!(a.path(), b.path());
    }

    #[test]
    fn sweep_removes_only_stale_trominal_dirs() {
        let base = PrivateDir::create().unwrap();
        let stale = PrivateDir::create_in(base.path()).unwrap();
        let stale_path = stale.path().to_path_buf();
        std::mem::forget(stale);
        let other = base.path().join("unrelated");
        fs::create_dir(&other).unwrap();

        sweep_stale_dirs_older_than(base.path(), Duration::from_secs(3600));
        assert!(stale_path.exists(), "fresh dirs are left alone");

        sweep_stale_dirs_older_than(base.path(), Duration::ZERO);
        assert!(!stale_path.exists());
        assert!(other.exists());
    }

    #[test]
    fn option_paths_escape_percent_and_quote_spaces() {
        assert_eq!(ssh_option_path(Path::new("/tmp/a")), "/tmp/a");
        assert_eq!(ssh_option_path(Path::new("/tmp/50%")), "/tmp/50%%");
        assert_eq!(
            ssh_option_path(Path::new("/Users/John Smith/x")),
            "\"/Users/John Smith/x\""
        );
    }

    #[test]
    fn rejects_encrypted_key_without_passphrase_before_touching_disk() {
        let dir = PrivateDir::create().unwrap();
        let key = SecretBytes::new(OPENSSH_ENCRYPTED.as_bytes().to_vec());
        let err = LoadedIdentity::load(&dir, &key, None, &LoadOptions::default()).unwrap_err();
        assert!(matches!(err, IdentityError::PassphraseRequired));
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 0);
    }

    /// End-to-end against the real OpenSSH tools: generate a key with
    /// ssh-keygen, load it through a private agent, and check that nothing
    /// but the public key and the socket ever lands in the directory.
    #[cfg(unix)]
    #[test]
    fn loads_key_into_private_agent_without_writing_it_to_disk() {
        let Some(key) = generate_key(None) else {
            eprintln!("skipping: ssh-keygen unavailable");
            return;
        };
        assert!(!private_key_is_encrypted(key.expose()));
        let dir = PrivateDir::create().unwrap();
        let identity =
            LoadedIdentity::load(&dir, &key, None, &LoadOptions::default()).expect("load");

        assert_no_private_key_on_disk(dir.path(), &key);
        let public = fs::read_to_string(identity.identity_file()).unwrap();
        assert!(public.starts_with("ssh-ed25519 "), "{public}");

        let options = identity.ssh_options();
        assert!(options.contains(&"IdentitiesOnly=yes".to_string()));
        assert!(options
            .iter()
            .any(|arg| arg.starts_with("IdentityAgent=") && arg.ends_with(AGENT_SOCKET)));
        assert!(!options.iter().any(|arg| arg == "IdentityAgent=none"));

        let socket = identity.agent_socket().to_path_buf();
        assert!(socket.exists());
        drop(identity);
        assert!(!socket.exists(), "agent socket removed when unloaded");
    }

    #[cfg(unix)]
    #[test]
    fn loads_encrypted_key_with_passphrase_via_askpass() {
        let Some(key) = generate_key(Some("correct horse")) else {
            eprintln!("skipping: ssh-keygen unavailable");
            return;
        };
        let Some(askpass) = askpass_script() else {
            return;
        };
        let options = LoadOptions {
            askpass_program: Some(askpass.path().join("askpass.sh")),
            tools_dir: None,
        };

        assert!(private_key_is_encrypted(key.expose()));
        let dir = PrivateDir::create().unwrap();
        let err = LoadedIdentity::load(&dir, &key, None, &options).unwrap_err();
        assert!(matches!(err, IdentityError::PassphraseRequired));

        let right = SecretBytes::new(b"correct horse".to_vec());
        let identity = LoadedIdentity::load(&dir, &key, Some(&right), &options).expect("load");
        assert_no_private_key_on_disk(dir.path(), &key);
        drop(identity);

        let dir = PrivateDir::create().unwrap();
        let wrong = SecretBytes::new(b"wrong".to_vec());
        let err = LoadedIdentity::load(&dir, &key, Some(&wrong), &options).unwrap_err();
        assert!(matches!(err, IdentityError::KeyRejected), "{err:?}");
    }

    #[cfg(unix)]
    fn generate_key(passphrase: Option<&str>) -> Option<SecretBytes> {
        let scratch = PrivateDir::create().ok()?;
        let path = scratch.path().join("k");
        let status = Command::new("ssh-keygen")
            .args(["-q", "-t", "ed25519", "-C", "test", "-N"])
            .arg(passphrase.unwrap_or(""))
            .arg("-f")
            .arg(&path)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .ok()?;
        if !status.success() {
            return None;
        }
        fs::read(&path).ok().map(SecretBytes::new)
    }

    /// Stand-in for the client binary's askpass mode (which uses
    /// `answer_askpass`); needs a netcat that speaks Unix sockets.
    #[cfg(unix)]
    fn askpass_script() -> Option<PrivateDir> {
        use std::os::unix::fs::PermissionsExt;
        let nc_ok = Command::new("sh")
            .arg("-c")
            .arg("command -v nc >/dev/null && nc -h 2>&1 | grep -q -- '-U'")
            .status()
            .is_ok_and(|status| status.success());
        if !nc_ok {
            eprintln!("skipping: no Unix-socket capable nc");
            return None;
        }
        let dir = PrivateDir::create().ok()?;
        let script = format!("#!/bin/sh\nexec nc -U \"${ASKPASS_SOCKET_ENV}\" </dev/null\n");
        let path = dir.write_file("askpass.sh", script.as_bytes()).ok()?;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o700)).ok()?;
        Some(dir)
    }

    #[cfg(unix)]
    #[test]
    fn askpass_server_answers_exactly_once() {
        let dir = PrivateDir::create().unwrap();
        let passphrase = SecretBytes::new(b"s3cret".to_vec());
        let server = AskpassServer::start(&dir, &passphrase).unwrap();

        let mut first = Vec::new();
        assert!(answer_askpass_from(server.socket(), &mut first));
        assert_eq!(first, b"s3cret\n");

        // Give the server thread a moment to stop listening.
        thread::sleep(Duration::from_millis(50));
        let mut second = Vec::new();
        assert!(!answer_askpass_from(server.socket(), &mut second));
        assert!(second.is_empty());

        let socket = server.socket().to_path_buf();
        drop(server);
        assert!(!socket.exists());
    }

    fn assert_no_private_key_on_disk(dir: &Path, key: &SecretBytes) {
        let marker = b"PRIVATE KEY";
        for entry in fs::read_dir(dir).unwrap().flatten() {
            let path = entry.path();
            if let Ok(contents) = fs::read(&path) {
                assert!(
                    !contains(&contents, marker) && !contains(&contents, key.expose()),
                    "private key material found in {}",
                    path.display()
                );
            }
        }
    }
}
