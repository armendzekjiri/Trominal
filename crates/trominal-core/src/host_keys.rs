//! Host-key pinning for every desktop SSH transport (terminal, tunnels,
//! SFTP, key install / test).
//!
//! The single policy: `ssh` never decides on its own whether to trust a
//! server. Before the first connection the client scans the server's keys
//! ([`scan_host_keys`]) and shows their SHA-256 fingerprints for explicit
//! approval; approved keys are stored in the host's encrypted vault record
//! and sent back with every connect. Each connection gets a private
//! `known_hosts` file containing only those pins, and `ssh` runs with
//! `StrictHostKeyChecking=yes` against that file and no other, so an
//! unknown or changed key is a hard failure. [`check_presented_keys`] and
//! [`HostKeyProblem`] turn that failure into a structured error the UI can
//! show (old vs new fingerprint) without ever offering to accept it inline.

use base64::Engine as _;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;
use std::io::Read;
use std::path::Path;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

/// Name every pinned key is filed under in the per-connection
/// `known_hosts`; `ssh` is told to look keys up by this alias
/// (`HostKeyAlias`), so the lookup is independent of how the host, port or
/// IP is spelled and of any alias in the user's ssh config.
pub const HOST_KEY_ALIAS: &str = "trominal-pinned-host";

/// Prefix of error strings that carry a serialized [`HostKeyProblem`].
pub const HOST_KEY_ERROR_PREFIX: &str = "trominal-host-key:";

/// Seconds `ssh-keyscan` waits for a server.
pub const SCAN_TIMEOUT_SECS: u64 = 10;

/// A server host key as shown to and approved by the user.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, PartialOrd, Ord)]
#[serde(rename_all = "camelCase")]
pub struct HostKey {
    /// SSH key type, e.g. `ssh-ed25519`.
    pub key_type: String,
    /// Base64 public key blob, exactly as in `known_hosts`.
    pub public_key: String,
    /// `SHA256:` fingerprint in OpenSSH's format.
    pub fingerprint: String,
}

/// A pin as sent by the frontend. The fingerprint is always recomputed.
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostKeyPin {
    pub key_type: String,
    pub public_key: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum HostKeyProblemKind {
    /// No key has been approved for this host yet.
    Unknown,
    /// The server presented keys, none of which matches the pins.
    Changed,
}

/// Structured host-key failure, serialized into command errors.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostKeyProblem {
    pub kind: HostKeyProblemKind,
    pub host: String,
    pub port: u16,
    /// Keys currently pinned in the vault.
    pub expected: Vec<HostKey>,
    /// Keys the server presented (empty if the scan failed).
    pub presented: Vec<HostKey>,
}

impl HostKeyProblem {
    /// `trominal-host-key:{json}` — what Tauri commands return as `Err`.
    pub fn to_error_string(&self) -> String {
        format!(
            "{HOST_KEY_ERROR_PREFIX}{}",
            serde_json::to_string(self).unwrap_or_else(|_| "{}".to_string())
        )
    }
}

/// Outcome of comparing presented keys with pins.
#[derive(Debug, PartialEq, Eq)]
pub enum HostKeyCheck {
    Trusted,
    Problem(HostKeyProblem),
}

/// SHA-256 fingerprint of a public key blob, formatted like `ssh-keygen -l`.
pub fn fingerprint_sha256(blob: &[u8]) -> String {
    let digest = Sha256::digest(blob);
    format!(
        "SHA256:{}",
        base64::engine::general_purpose::STANDARD_NO_PAD.encode(digest)
    )
}

/// Validate a key type + base64 blob and compute its fingerprint. The blob
/// must decode and must start with the same key type string, so a pin
/// can't claim to be one type while carrying another.
pub fn parse_host_key(key_type: &str, public_key: &str) -> Result<HostKey, String> {
    let key_type = key_type.trim();
    let public_key = public_key.trim();
    if key_type.is_empty()
        || !key_type
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '@' | '.' | '_'))
    {
        return Err("invalid host key type".to_string());
    }
    let blob = base64::engine::general_purpose::STANDARD
        .decode(public_key)
        .map_err(|_| "invalid host key encoding".to_string())?;
    let embedded = blob
        .get(..4)
        .map(|len| u32::from_be_bytes([len[0], len[1], len[2], len[3]]) as usize)
        .and_then(|len| blob.get(4..4 + len))
        .ok_or_else(|| "invalid host key data".to_string())?;
    if embedded != key_type.as_bytes() {
        return Err("host key type does not match its data".to_string());
    }
    Ok(HostKey {
        key_type: key_type.to_string(),
        public_key: public_key.to_string(),
        fingerprint: fingerprint_sha256(&blob),
    })
}

/// Validate frontend pins. Any invalid pin fails the whole set.
pub fn parse_pins(pins: &[HostKeyPin]) -> Result<Vec<HostKey>, String> {
    let keys = pins
        .iter()
        .map(|pin| parse_host_key(&pin.key_type, &pin.public_key))
        .collect::<Result<BTreeSet<_>, _>>()?;
    Ok(keys.into_iter().collect())
}

/// Parse `ssh-keyscan` output (`host keytype base64` lines, `#` comments).
/// Unparseable lines are skipped; duplicates are removed.
pub fn parse_keyscan_output(output: &str) -> Vec<HostKey> {
    let keys: BTreeSet<HostKey> = output
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .filter_map(|line| {
            let mut fields = line.split_whitespace();
            let _host = fields.next()?;
            let key_type = fields.next()?;
            let blob = fields.next()?;
            parse_host_key(key_type, blob).ok()
        })
        .collect();
    keys.into_iter().collect()
}

/// Contents of the private per-connection `known_hosts` file.
pub fn known_hosts_contents(pins: &[HostKey]) -> String {
    pins.iter()
        .map(|key| format!("{HOST_KEY_ALIAS} {} {}\n", key.key_type, key.public_key))
        .collect()
}

/// `ssh` / `sftp` options enforcing the pins in `known_hosts_path`.
/// `known_hosts_value` must already be formatted for an ssh option value.
pub fn host_key_options(known_hosts_value: &str) -> Vec<String> {
    let null_file = if cfg!(windows) { "NUL" } else { "/dev/null" };
    [
        "StrictHostKeyChecking=yes".to_string(),
        format!("UserKnownHostsFile={known_hosts_value}"),
        format!("GlobalKnownHostsFile={null_file}"),
        format!("HostKeyAlias={HOST_KEY_ALIAS}"),
        "CheckHostIP=no".to_string(),
        "UpdateHostKeys=no".to_string(),
    ]
    .into_iter()
    .flat_map(|option| ["-o".to_string(), option])
    .collect()
}

/// Compare what the server presented with the pins.
pub fn check_presented_keys(
    host: &str,
    port: u16,
    pins: &[HostKey],
    presented: &[HostKey],
) -> HostKeyCheck {
    if !pins.is_empty() && presented.iter().any(|key| pins.contains(key)) {
        return HostKeyCheck::Trusted;
    }
    HostKeyCheck::Problem(HostKeyProblem {
        kind: if pins.is_empty() {
            HostKeyProblemKind::Unknown
        } else {
            HostKeyProblemKind::Changed
        },
        host: host.to_string(),
        port,
        expected: pins.to_vec(),
        presented: presented.to_vec(),
    })
}

/// True when ssh/sftp output says host-key verification is what failed.
pub fn is_host_key_failure(output: &str) -> bool {
    output.contains("Host key verification failed")
        || output.contains("REMOTE HOST IDENTIFICATION HAS CHANGED")
        || output.contains("host key is known for")
}

/// Hostnames and usernames end up as `ssh` arguments; reject anything that
/// could be parsed as an option or split into several arguments.
pub fn validate_destination_part(value: &str, what: &str) -> Result<(), String> {
    if value.starts_with('-') {
        return Err(format!("{what} must not start with '-'"));
    }
    if value
        .chars()
        .any(|ch| ch.is_whitespace() || ch.is_control() || ch == ',')
    {
        return Err(format!("{what} contains unsupported characters"));
    }
    Ok(())
}

/// Fetch the server's host keys with `ssh-keyscan` (bounded by
/// [`SCAN_TIMEOUT_SECS`]). This is the unauthenticated first look that the
/// user then approves by fingerprint.
pub fn scan_host_keys(host: &str, port: u16) -> Result<Vec<HostKey>, String> {
    scan_host_keys_with(Path::new("ssh-keyscan"), host, port)
}

pub fn scan_host_keys_with(program: &Path, host: &str, port: u16) -> Result<Vec<HostKey>, String> {
    let host = host.trim();
    if host.is_empty() {
        return Err("host is required".to_string());
    }
    validate_destination_part(host, "host")?;
    let mut child = Command::new(program)
        .arg("-T")
        .arg(SCAN_TIMEOUT_SECS.to_string())
        .arg("-p")
        .arg(port.max(1).to_string())
        .arg("--")
        .arg(host)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|err| format!("could not run ssh-keyscan: {err}"))?;
    let mut stdout = child.stdout.take();
    let reader = thread::spawn(move || {
        let mut output = String::new();
        if let Some(pipe) = stdout.as_mut() {
            let _ = pipe.read_to_string(&mut output);
        }
        output
    });
    let deadline = Instant::now() + Duration::from_secs(SCAN_TIMEOUT_SECS + 5);
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if Instant::now() < deadline => thread::sleep(Duration::from_millis(20)),
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                break;
            }
        }
    }
    let keys = parse_keyscan_output(&reader.join().unwrap_or_default());
    if keys.is_empty() {
        return Err(format!(
            "could not read host keys from {host}:{}",
            port.max(1)
        ));
    }
    Ok(keys)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Real keys (from ssh-keygen) with fingerprints from `ssh-keygen -lf`.
    const ED25519: &str = "AAAAC3NzaC1lZDI1NTE5AAAAIAJ0zOYsiehXYJEtufsQzfH49rgGwhlP1w6Ub9IZS3b9";
    const ED25519_FP: &str = "SHA256:cc+OHycpL60Ov6zbIi5p9icXpZtp03nkzYuzTVU/dC4";
    const OTHER_ED25519: &str =
        "AAAAC3NzaC1lZDI1NTE5AAAAIB0DWUzzfmsj0qLl7lZVRfhNC1x98nyQCs4PbVsvm0ob";

    fn key(blob: &str) -> HostKey {
        parse_host_key("ssh-ed25519", blob).unwrap()
    }

    #[test]
    fn computes_openssh_sha256_fingerprints() {
        assert_eq!(key(ED25519).fingerprint, ED25519_FP);
    }

    #[test]
    fn rejects_pins_whose_type_does_not_match_the_blob() {
        assert!(parse_host_key("ssh-rsa", ED25519).is_err());
        assert!(parse_host_key("ssh-ed25519", "not base64!").is_err());
        assert!(parse_host_key("ssh-ed25519", "AAAA").is_err());
        assert!(parse_host_key("ssh ed25519", ED25519).is_err());
        assert!(parse_host_key("", ED25519).is_err());
    }

    #[test]
    fn parses_keyscan_output_and_ignores_noise() {
        let output = format!(
            "# 127.0.0.1:2222 SSH-2.0-OpenSSH_10.0\n\
             [127.0.0.1]:2222 ssh-ed25519 {ED25519}\n\
             [127.0.0.1]:2222 ssh-ed25519 {ED25519}\n\
             [127.0.0.1]:2222 ssh-rsa garbage\n\
             \n"
        );
        let keys = parse_keyscan_output(&output);
        assert_eq!(keys.len(), 1);
        assert_eq!(keys[0].fingerprint, ED25519_FP);
    }

    #[test]
    fn known_hosts_lists_only_the_pins_under_the_alias() {
        let contents = known_hosts_contents(&[key(ED25519)]);
        assert_eq!(
            contents,
            format!("{HOST_KEY_ALIAS} ssh-ed25519 {ED25519}\n")
        );
        assert_eq!(known_hosts_contents(&[]), "");
    }

    #[test]
    fn host_key_options_are_strict_and_never_accept_new_keys() {
        let options = host_key_options("/run/trm/known_hosts");
        let joined = options.join(" ");
        assert!(!joined.contains("accept-new"));
        assert!(!joined.contains("StrictHostKeyChecking=no"));
        assert!(options.contains(&"StrictHostKeyChecking=yes".to_string()));
        assert!(options.contains(&"UserKnownHostsFile=/run/trm/known_hosts".to_string()));
        assert!(options.contains(&format!("HostKeyAlias={HOST_KEY_ALIAS}")));
        assert!(options.contains(&"UpdateHostKeys=no".to_string()));
        let global = if cfg!(windows) { "NUL" } else { "/dev/null" };
        assert!(options.contains(&format!("GlobalKnownHostsFile={global}")));
        // Every option is preceded by -o.
        for pair in options.chunks(2) {
            assert_eq!(pair[0], "-o");
        }
    }

    #[test]
    fn trusted_only_when_a_presented_key_matches_a_pin() {
        let pinned = vec![key(ED25519)];
        assert_eq!(
            check_presented_keys("h", 22, &pinned, &[key(OTHER_ED25519), key(ED25519)]),
            HostKeyCheck::Trusted
        );

        let HostKeyCheck::Problem(changed) =
            check_presented_keys("h", 22, &pinned, &[key(OTHER_ED25519)])
        else {
            panic!("expected a problem");
        };
        assert_eq!(changed.kind, HostKeyProblemKind::Changed);
        assert_eq!(changed.expected[0].fingerprint, ED25519_FP);
        assert_eq!(changed.presented[0].public_key, OTHER_ED25519);

        let HostKeyCheck::Problem(unknown) = check_presented_keys("h", 22, &[], &[key(ED25519)])
        else {
            panic!("expected a problem");
        };
        assert_eq!(unknown.kind, HostKeyProblemKind::Unknown);
    }

    #[test]
    fn serializes_problems_with_a_recognizable_prefix() {
        let HostKeyCheck::Problem(problem) =
            check_presented_keys("example.com", 2222, &[key(ED25519)], &[key(OTHER_ED25519)])
        else {
            panic!("expected a problem");
        };
        let error = problem.to_error_string();
        let json = error.strip_prefix(HOST_KEY_ERROR_PREFIX).unwrap();
        let value: serde_json::Value = serde_json::from_str(json).unwrap();
        assert_eq!(value["kind"], "changed");
        assert_eq!(value["host"], "example.com");
        assert_eq!(value["port"], 2222);
        assert_eq!(value["expected"][0]["fingerprint"], ED25519_FP);
        assert_eq!(value["presented"][0]["keyType"], "ssh-ed25519");
    }

    #[test]
    fn recognizes_ssh_host_key_failures() {
        assert!(is_host_key_failure("Host key verification failed.\r\n"));
        assert!(is_host_key_failure(
            "@    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @"
        ));
        assert!(is_host_key_failure(
            "No ED25519 host key is known for trominal-pinned-host and you have requested strict checking."
        ));
        assert!(!is_host_key_failure("Permission denied (publickey)."));
    }

    #[test]
    fn rejects_destinations_that_could_become_options() {
        assert!(validate_destination_part("-oProxyCommand=x", "host").is_err());
        assert!(validate_destination_part("a b", "host").is_err());
        assert!(validate_destination_part("a,b", "host").is_err());
        assert!(validate_destination_part("a\nb", "username").is_err());
        assert!(validate_destination_part("db-01.internal", "host").is_ok());
        assert!(validate_destination_part("::1", "host").is_ok());
        assert!(scan_host_keys("-oProxyCommand=x", 22).is_err());
    }
}
