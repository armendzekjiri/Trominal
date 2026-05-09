//! Pure data types shared between the desktop client (`apps/client/src-tauri`)
//! and the local helper CLI (`crates/trominal-helper`). Both surfaces accept
//! identical request payloads from their respective frontends and emit
//! identical event payloads back, so the wire-protocol shapes belong here.
//!
//! Fields are `pub` because both crates destructure or read them directly.
//! The serde rename rules match the Tauri command surface that the existing
//! frontend already speaks.

use serde::{Deserialize, Serialize};

// ---------- Event payloads ----------

#[derive(Clone, Serialize)]
pub struct LocalShellData {
    pub session_id: String,
    pub data: Vec<u8>,
}

#[derive(Clone, Serialize)]
pub struct LocalShellClosed {
    pub session_id: String,
    pub reason: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpTransferEvent {
    pub transfer_id: String,
    pub state: &'static str,
    pub message: Option<String>,
}

// ---------- SSH session requests / responses ----------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshConnectRequest {
    pub session_id: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub cols: u16,
    pub rows: u16,
    pub private_key_pem: Option<Vec<u8>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshKeyTestRequest {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub private_key_pem: Vec<u8>,
}

#[derive(Serialize)]
pub struct SshKeyTestResponse {
    pub works: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshKeyInstallRequest {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub public_key: String,
    pub password: Vec<u8>,
}

#[derive(Serialize)]
pub struct SshKeyInstallResponse {
    pub installed: bool,
    pub method: String,
}

// ---------- SSH tunnel requests / responses ----------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshTunnelOpenRequest {
    pub session_id: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub private_key_pem: Vec<u8>,
    pub tunnel: SshTunnelSpec,
}

#[derive(Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase"
)]
pub enum SshTunnelSpec {
    Local {
        bind_host: String,
        bind_port: u16,
        target_host: String,
        target_port: u16,
    },
    Remote {
        bind_host: String,
        bind_port: u16,
        target_host: String,
        target_port: u16,
    },
    Socks {
        bind_host: String,
        bind_port: u16,
    },
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshTunnelOpenResponse {
    pub session_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshTunnelStatusResponse {
    pub running: bool,
}

// ---------- SFTP requests / responses ----------

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SftpHostArgs {
    pub host: String,
    pub port: u16,
    pub username: String,
    /// PEM-encoded private key. Caller is responsible for zeroizing after use.
    pub private_key_pem: Vec<u8>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpListRequest {
    pub host: SftpHostArgs,
    pub remote_path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpHomeRequest {
    pub host: SftpHostArgs,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpHomeResponse {
    pub path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpPathRequest {
    pub host: SftpHostArgs,
    pub remote_path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpRemoveRequest {
    pub host: SftpHostArgs,
    pub remote_path: String,
    pub is_dir: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpRenameRequest {
    pub host: SftpHostArgs,
    pub from_path: String,
    pub to_path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpTransferRequest {
    pub transfer_id: String,
    pub host: SftpHostArgs,
    pub local_path: String,
    pub remote_path: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SftpEntry {
    pub name: String,
    pub kind: String,
    pub size: u64,
    pub modified: String,
    pub permissions: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpListResponse {
    pub entries: Vec<SftpEntry>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpTransferStartResponse {
    pub transfer_id: String,
}

// ---------- Local-filesystem requests (dual-pane left side) ----------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalListRequest {
    pub path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalListResponse {
    pub path: String,
    pub entries: Vec<SftpEntry>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalHomeResponse {
    pub path: String,
}
