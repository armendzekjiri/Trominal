//! Tauri commands that proxy reads/writes to the OS keychain via the `keyring`
//! crate. The frontend never touches the keyring directly; it calls these
//! commands and receives plain strings.
//!
//! Service name is `trominal`. Each entry uses the supplied logical key as the
//! account name. Errors are surfaced as user-safe strings so the frontend can
//! decide whether to retry, fall back, or surface to the user.

use keyring::Entry;
use thiserror::Error;

const SERVICE: &str = "trominal";

#[derive(Debug, Error)]
pub enum SecureStorageError {
    #[error("secure storage is unavailable on this platform: {0}")]
    Unavailable(String),
    #[error("secure storage operation failed: {0}")]
    Other(String),
}

impl From<keyring::Error> for SecureStorageError {
    fn from(err: keyring::Error) -> Self {
        match err {
            keyring::Error::PlatformFailure(e) => Self::Unavailable(e.to_string()),
            keyring::Error::NoStorageAccess(e) => Self::Unavailable(e.to_string()),
            other => Self::Other(other.to_string()),
        }
    }
}

fn entry(key: &str) -> Result<Entry, SecureStorageError> {
    Entry::new(SERVICE, key).map_err(SecureStorageError::from)
}

/// Persist `value` for `key` in the OS keychain. Overwrites any existing value.
#[tauri::command]
pub fn secure_set(key: String, value: String) -> Result<(), String> {
    entry(&key)
        .and_then(|e| e.set_password(&value).map_err(SecureStorageError::from))
        .map_err(|e| e.to_string())
}

/// Read the stored string for `key`. Returns `None` if no entry exists.
#[tauri::command]
pub fn secure_get(key: String) -> Result<Option<String>, String> {
    let entry = entry(&key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(other) => Err(SecureStorageError::from(other).to_string()),
    }
}

/// Delete the entry for `key`. Returns Ok even if the entry was already absent.
#[tauri::command]
pub fn secure_delete(key: String) -> Result<(), String> {
    let entry = entry(&key).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(other) => Err(SecureStorageError::from(other).to_string()),
    }
}
