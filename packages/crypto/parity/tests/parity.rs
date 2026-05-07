//! Cross-platform parity tests.
//!
//! Reads `packages/crypto/tests/fixtures/cross-platform.json` and asserts that
//! a pure-Rust implementation of the same RFCs (Argon2id RFC 9106,
//! XChaCha20-Poly1305-IETF) produces byte-equal output to the JS
//! `@trominal/crypto` implementation. CI runs both arms and fails the build
//! if they ever diverge.

use std::fs;
use std::path::PathBuf;

use argon2::{Algorithm, Argon2, Params, Version};
use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{Key, XChaCha20Poly1305, XNonce};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct Fixture {
    kdf: Vec<KdfFixture>,
    aead: Vec<AeadFixture>,
}

#[derive(Debug, Deserialize)]
struct KdfFixture {
    name: String,
    password: String,
    salt_hex: String,
    memlimit: usize,
    opslimit: u32,
    out_len: usize,
    expected_key_hex: String,
}

#[derive(Debug, Deserialize)]
struct AeadFixture {
    name: String,
    key_hex: String,
    nonce_hex: String,
    ad: String,
    plaintext_hex: String,
    expected_ciphertext_hex: String,
}

fn load_fixture() -> Fixture {
    let mut path: PathBuf = std::env::var("CARGO_MANIFEST_DIR")
        .map(PathBuf::from)
        .expect("CARGO_MANIFEST_DIR not set");
    path.pop(); // packages/crypto/parity → packages/crypto
    path.push("tests");
    path.push("fixtures");
    path.push("cross-platform.json");
    let raw = fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("failed to read {}: {e}", path.display()));
    serde_json::from_str(&raw).expect("malformed fixture json")
}

#[test]
fn kdf_parity() {
    let fixture = load_fixture();
    for f in fixture.kdf {
        let salt = hex::decode(&f.salt_hex).expect("bad salt hex");

        // libsodium's memlimit is bytes; argon2 crate's m_cost is KiB.
        let m_cost_kib = u32::try_from(f.memlimit / 1024).expect("memlimit too large");
        let params = Params::new(m_cost_kib, f.opslimit, 1, Some(f.out_len))
            .expect("invalid argon2 params");
        let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

        let mut out = vec![0u8; f.out_len];
        argon
            .hash_password_into(f.password.as_bytes(), &salt, &mut out)
            .expect("argon2 hash_password_into failed");

        let actual_hex = hex::encode(&out);
        assert_eq!(
            actual_hex, f.expected_key_hex,
            "kdf fixture `{}` diverges between Rust and JS",
            f.name
        );
    }
}

#[test]
fn aead_parity() {
    let fixture = load_fixture();
    for f in fixture.aead {
        let key_bytes = hex::decode(&f.key_hex).expect("bad key hex");
        let nonce_bytes = hex::decode(&f.nonce_hex).expect("bad nonce hex");
        let plaintext = hex::decode(&f.plaintext_hex).expect("bad plaintext hex");

        assert_eq!(
            key_bytes.len(),
            32,
            "fixture `{}` key is not 32 bytes",
            f.name
        );
        assert_eq!(
            nonce_bytes.len(),
            24,
            "fixture `{}` nonce is not 24 bytes",
            f.name
        );

        let cipher = XChaCha20Poly1305::new(Key::from_slice(&key_bytes));
        let nonce = XNonce::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(
                nonce,
                Payload {
                    msg: &plaintext,
                    aad: f.ad.as_bytes(),
                },
            )
            .expect("aead encrypt failed");

        let actual_hex = hex::encode(&ciphertext);
        assert_eq!(
            actual_hex, f.expected_ciphertext_hex,
            "aead fixture `{}` ciphertext diverges between Rust and JS",
            f.name
        );

        // Round-trip: decryption must succeed and recover plaintext.
        let recovered = cipher
            .decrypt(
                nonce,
                Payload {
                    msg: &ciphertext,
                    aad: f.ad.as_bytes(),
                },
            )
            .expect("aead decrypt failed");
        assert_eq!(
            recovered, plaintext,
            "aead fixture `{}` round-trip mismatch",
            f.name
        );
    }
}
