//! Everything one `ssh` / `sftp` / `ssh-copy-id` process needs from the
//! shared policy: a private directory, the pinned `known_hosts`, an empty
//! config file, and (optionally) a loaded identity. Dropping a
//! [`PreparedSsh`] unloads the key and deletes the directory, so sessions
//! keep it alive for exactly as long as the child process runs.

use crate::host_keys::{
    host_key_options, known_hosts_contents, parse_pins, validate_destination_part, HostKey,
    HostKeyPin, HostKeyProblem, HostKeyProblemKind,
};
use crate::secret::SecretBytes;
use crate::ssh_identity::{
    is_rsa_private_key, ssh_option_path, IdentityError, LoadOptions, LoadedIdentity, PrivateDir,
};
use std::path::PathBuf;

/// Private key plus optional passphrase for one connection.
pub struct SshKeyMaterial<'a> {
    pub private_key: &'a SecretBytes,
    pub passphrase: Option<&'a SecretBytes>,
}

#[derive(Debug)]
pub struct PreparedSsh {
    // Field order matters: the identity (agent) goes before the directory
    // that holds its socket.
    identity: Option<LoadedIdentity>,
    known_hosts_option: String,
    config_path: String,
    pins: Vec<HostKey>,
    rsa_key: bool,
    dir: PrivateDir,
}

impl PreparedSsh {
    /// Validate the pins, write the pinned `known_hosts`, and load `key`
    /// (if any) without writing it to disk (see [`crate::ssh_identity`]).
    /// With no pins this fails with an `Unknown` [`HostKeyProblem`]: the
    /// caller must get the user's approval first.
    pub fn prepare(
        host: &str,
        port: u16,
        pins: &[HostKeyPin],
        key: Option<SshKeyMaterial<'_>>,
        options: &LoadOptions,
    ) -> Result<Self, String> {
        let pins = parse_pins(pins)?;
        if pins.is_empty() {
            return Err(HostKeyProblem {
                kind: HostKeyProblemKind::Unknown,
                host: host.trim().to_string(),
                port,
                expected: Vec::new(),
                presented: Vec::new(),
            }
            .to_error_string());
        }
        let dir = PrivateDir::create().map_err(|err| err.to_string())?;
        let known_hosts = dir
            .write_file("known_hosts", known_hosts_contents(&pins).as_bytes())
            .map_err(|err| err.to_string())?;
        let config = dir
            .write_file("config", b"")
            .map_err(|err| err.to_string())?;
        let (identity, rsa_key) = match key {
            Some(material) => {
                let rsa = is_rsa_private_key(material.private_key.expose());
                let identity =
                    LoadedIdentity::load(&dir, material.private_key, material.passphrase, options)
                        .map_err(|err: IdentityError| err.to_string())?;
                (Some(identity), rsa)
            }
            None => (None, false),
        };
        Ok(Self {
            identity,
            known_hosts_option: ssh_option_path(&known_hosts),
            config_path: config.to_string_lossy().into_owned(),
            pins,
            rsa_key,
            dir,
        })
    }

    /// Options shared by every transport: an empty config when a vault key
    /// is used (so `~/.ssh/config` identities can't interfere), the
    /// identity, and the host-key policy.
    pub fn ssh_options(&self) -> Vec<String> {
        let mut args = Vec::new();
        if let Some(identity) = &self.identity {
            args.push("-F".to_string());
            args.push(self.config_path.clone());
            args.extend(identity.ssh_options());
        }
        args.extend(host_key_options(&self.known_hosts_option));
        args
    }

    /// The approved keys this connection enforces.
    pub fn pins(&self) -> &[HostKey] {
        &self.pins
    }

    /// Whether the loaded key is RSA (needs `+ssh-rsa` compat options).
    pub fn rsa_key(&self) -> bool {
        self.rsa_key
    }

    pub fn has_identity(&self) -> bool {
        self.identity.is_some()
    }

    /// Put a non-secret helper file (e.g. a public key for `ssh-copy-id`)
    /// in this connection's private directory.
    pub fn write_public_file(&self, name: &str, contents: &[u8]) -> Result<PathBuf, String> {
        self.dir
            .write_file(name, contents)
            .map_err(|err| err.to_string())
    }
}

/// `user@host` after rejecting values that `ssh` could parse as options.
pub fn ssh_destination(host: &str, username: &str) -> Result<String, String> {
    let host = host.trim();
    let username = username.trim();
    if host.is_empty() {
        return Err("host is required".to_string());
    }
    validate_destination_part(host, "host")?;
    validate_destination_part(username, "username")?;
    Ok(if username.is_empty() {
        host.to_string()
    } else {
        format!("{username}@{host}")
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::host_keys::HOST_KEY_ERROR_PREFIX;
    use std::fs;
    use std::path::Path;

    const ED25519: &str = "AAAAC3NzaC1lZDI1NTE5AAAAIAJ0zOYsiehXYJEtufsQzfH49rgGwhlP1w6Ub9IZS3b9";

    fn pin() -> HostKeyPin {
        HostKeyPin {
            key_type: "ssh-ed25519".to_string(),
            public_key: ED25519.to_string(),
        }
    }

    fn option_value<'a>(args: &'a [String], key: &str) -> Option<&'a str> {
        args.iter()
            .find_map(|arg| arg.strip_prefix(&format!("{key}=")))
    }

    #[test]
    fn refuses_to_connect_without_an_approved_host_key() {
        let err = PreparedSsh::prepare("example.com", 22, &[], None, &LoadOptions::default())
            .unwrap_err();
        assert!(err.starts_with(HOST_KEY_ERROR_PREFIX), "{err}");
        assert!(err.contains("\"unknown\""));
    }

    #[test]
    fn rejects_malformed_pins() {
        let bad = HostKeyPin {
            key_type: "ssh-rsa".to_string(),
            public_key: ED25519.to_string(),
        };
        assert!(PreparedSsh::prepare("h", 22, &[bad], None, &LoadOptions::default()).is_err());
    }

    #[test]
    fn writes_only_the_pins_to_a_private_known_hosts_file() {
        let prepared =
            PreparedSsh::prepare("h", 22, &[pin()], None, &LoadOptions::default()).unwrap();
        let args = prepared.ssh_options();
        let known_hosts = option_value(&args, "UserKnownHostsFile").unwrap();
        let contents = fs::read_to_string(known_hosts.trim_matches('"')).unwrap();
        assert_eq!(
            contents,
            format!("trominal-pinned-host ssh-ed25519 {ED25519}\n")
        );
        assert_eq!(option_value(&args, "StrictHostKeyChecking"), Some("yes"));
        assert!(!args.iter().any(|arg| arg.contains("accept-new")));
        // No vault key: the user's own ssh config and agent stay in charge
        // of authentication, only host keys are pinned.
        assert!(!args.contains(&"-F".to_string()));
        assert!(!args.contains(&"-i".to_string()));

        let dir = Path::new(known_hosts.trim_matches('"'))
            .parent()
            .unwrap()
            .to_path_buf();
        drop(prepared);
        assert!(!dir.exists(), "private dir removed with the session");
    }

    #[cfg(unix)]
    #[test]
    fn key_material_only_reaches_ssh_through_the_agent() {
        use std::process::{Command, Stdio};
        let scratch = PrivateDir::create().unwrap();
        let key_path = scratch.path().join("k");
        let generated = Command::new("ssh-keygen")
            .args(["-q", "-t", "ed25519", "-N", "", "-f"])
            .arg(&key_path)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .is_ok_and(|status| status.success());
        if !generated {
            eprintln!("skipping: ssh-keygen unavailable");
            return;
        }
        let key = SecretBytes::new(fs::read(&key_path).unwrap());
        drop(scratch);

        let prepared = PreparedSsh::prepare(
            "h",
            22,
            &[pin()],
            Some(SshKeyMaterial {
                private_key: &key,
                passphrase: None,
            }),
            &LoadOptions::default(),
        )
        .unwrap();
        let args = prepared.ssh_options();
        assert!(args.contains(&"IdentitiesOnly=yes".to_string()));
        let agent = option_value(&args, "IdentityAgent").unwrap();
        assert_ne!(agent, "none");
        let identity_index = args.iter().position(|arg| arg == "-i").unwrap();
        let identity_file = &args[identity_index + 1];
        let identity = fs::read_to_string(identity_file).unwrap();
        assert!(identity.starts_with("ssh-ed25519 "));
        assert!(!identity.contains("PRIVATE KEY"));

        // Nothing in the private directory holds the private key.
        let dir = Path::new(identity_file).parent().unwrap();
        for entry in fs::read_dir(dir).unwrap().flatten() {
            if let Ok(contents) = fs::read(entry.path()) {
                assert!(!contents.windows(11).any(|w| w == b"PRIVATE KEY"));
            }
        }
    }

    #[test]
    fn destination_rejects_option_injection() {
        assert_eq!(ssh_destination(" h ", " u ").unwrap(), "u@h");
        assert_eq!(ssh_destination("h", "").unwrap(), "h");
        assert!(ssh_destination("-oProxyCommand=evil", "u").is_err());
        assert!(ssh_destination("h", "-oProxyCommand=evil").is_err());
        assert!(ssh_destination("", "u").is_err());
    }
}
