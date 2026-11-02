//! Byte buffers for secrets (private keys, passwords, passphrases) that are
//! wiped when dropped and never printed.

use serde::{Deserialize, Deserializer};
use std::fmt;
use zeroize::Zeroizing;

/// Secret bytes received from the frontend. The buffer is zeroed on drop,
/// `Debug` never shows the contents, and there is deliberately no `Clone`
/// so copies can't be made by accident.
#[derive(Default)]
pub struct SecretBytes(Zeroizing<Vec<u8>>);

impl SecretBytes {
    pub fn new(bytes: Vec<u8>) -> Self {
        Self(Zeroizing::new(bytes))
    }

    pub fn expose(&self) -> &[u8] {
        &self.0
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    pub fn len(&self) -> usize {
        self.0.len()
    }
}

impl From<Vec<u8>> for SecretBytes {
    fn from(bytes: Vec<u8>) -> Self {
        Self::new(bytes)
    }
}

impl fmt::Debug for SecretBytes {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "SecretBytes([redacted; {}])", self.0.len())
    }
}

impl<'de> Deserialize<'de> for SecretBytes {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        Vec::<u8>::deserialize(deserializer).map(Self::new)
    }
}

#[cfg(test)]
mod tests {
    use super::SecretBytes;

    #[test]
    fn debug_output_never_contains_the_secret() {
        let secret = SecretBytes::new(b"hunter2".to_vec());
        let shown = format!("{secret:?}");
        assert!(!shown.contains("hunter2"));
        assert!(shown.contains("redacted"));
    }

    #[test]
    fn deserializes_from_a_json_byte_array() {
        let secret: SecretBytes = serde_json::from_str("[104,105]").unwrap();
        assert_eq!(secret.expose(), b"hi");
    }
}
