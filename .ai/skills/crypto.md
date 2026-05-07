# Skill: Crypto

> Load this when working on anything in `packages/crypto/`, `packages/ssh-transport/`, vault encryption, key handling, or auth.

## Mandatory primitives

| Operation       | Primitive             | TS lib                                      | Rust lib                              |
| --------------- | --------------------- | ------------------------------------------- | ------------------------------------- |
| Password → key  | Argon2id (RFC 9106)   | `libsodium-wrappers-sumo` (`crypto_pwhash`) | `argon2` (RustCrypto)                 |
| Symmetric AEAD  | XChaCha20-Poly1305    | `crypto_aead_xchacha20poly1305_ietf_*`      | `chacha20poly1305::XChaCha20Poly1305` |
| Random bytes    | `randombytes_buf`     | same                                        | `rand` / `getrandom`                  |
| Ed25519 keypair | `crypto_sign_keypair` | same                                        | `ed25519-dalek`                       |

The cross-platform parity test in `packages/crypto/parity/` asserts the JS and Rust implementations produce byte-equal output. We deliberately use pure-Rust RustCrypto crates rather than libsodium FFI on the Rust side: it removes the system-libsodium dependency and the matching ciphertexts prove RFC compliance on both sides.

**Forbidden:** AES-GCM with random nonces (nonce reuse risk), SHA1 anywhere, MD5, custom crypto, Math.random for any security purpose.

## Argon2id parameters (current version: v1)

```
memlimit:   64 * 1024 * 1024  (64 MiB)
opslimit:   3
algorithm:  ARGON2ID
salt:       16 bytes random per user
output:     32 bytes
```

Stored on user record as JSON:

```json
{
  "version": 1,
  "alg": "argon2id",
  "memlimit": 67108864,
  "opslimit": 3,
  "salt_len": 16,
  "out_len": 32
}
```

**Future-proofing:** always pass these from the `kdf_params` field, never hardcode in a function. Allows raising parameters in v2 without breaking existing users.

## XChaCha20-Poly1305 envelope

Every encrypted record on the server has this shape:

```typescript
type Envelope = {
  v: 1 // envelope version
  ct: string // base64 ciphertext (includes Poly1305 tag)
  n: string // base64 24-byte nonce
}
```

### Associated data binding

Every encrypt/decrypt call MUST pass `associated_data`:

```typescript
const ad = `trominal:v1:${resourceType}:${resourceId}`
// e.g.  "trominal:v1:host_credential:cred_01HXYZ..."
```

This prevents the server from swapping ciphertexts between resources. If ciphertext for host A's password is moved to host B, decryption fails because AD doesn't match.

For records without an ID yet (creation flow), use a client-generated ULID.

## Key handling rules

1. **Vault key lives in memory only.** Never write to disk. Never log. Never send over the network.
2. **Wipe on lock.** When the vault auto-locks or the user logs out, overwrite the key buffer with zeros and drop the reference.
3. **Rust:** wrap key in `Zeroizing<[u8; 32]>` from the `zeroize` crate.
4. **TypeScript:** use a `Uint8Array`. On wipe, call `.fill(0)` then drop reference. Browsers won't immediately GC, but this minimizes the window.
5. **Don't pass keys through React state.** Use a Zustand store with a manual reset action; never serialize.

## Cross-platform parity test (REQUIRED in CI)

The same plaintext + key + nonce must produce the same ciphertext in TS and Rust. Failing this test = release blocker.

Test fixture format (`packages/crypto/tests/fixtures/cross-platform.json`):

```json
[
  {
    "name": "basic round-trip",
    "key_hex": "0001020304...",
    "nonce_hex": "00000000000000000000000000000000000000000000000000",
    "ad": "trominal:v1:test:1",
    "plaintext_hex": "48656c6c6f",
    "expected_ciphertext_hex": "..."
  }
]
```

Both languages run this fixture and assert byte-equal output.

## Common mistakes to avoid

- ❌ Passing the password to the server. **Only the salt + KDF params travel.**
- ❌ Reusing a nonce. Always generate fresh: `randombytes_buf(24)`.
- ❌ Storing the vault key in localStorage / IndexedDB / Tauri storage. **In-memory only.**
- ❌ Encrypting without AD. AEAD without AD = wasted protection.
- ❌ Using `crypto.getRandomValues` instead of libsodium for cipher ops (consistency matters; we want one library doing all crypto).
- ❌ Logging ciphertext. Even ciphertext can correlate users; redact in logs.

## Master-password change flow

This one's tricky because it requires re-encrypting every vault item.

```
1. Client: prompt for current master password
2. Client: derive old_vault_key, verify by decrypting one canary item
3. Client: prompt for new master password (zxcvbn ≥ 3)
4. Client: generate new_kdf_salt (16 random bytes)
5. Client: derive new_vault_key
6. Client: fetch ALL vault items
7. Client: decrypt with old_vault_key, re-encrypt with new_vault_key
8. Client: POST /api/v1/me/master-password/change with:
     {
       new_kdf_salt, new_kdf_params,
       items: [{ id, type, ciphertext, nonce }, ...]
     }
9. Server: ATOMIC TX:
     - update user.kdf_salt, user.kdf_params
     - update each ciphertext+nonce
     - bump user.vault_version
     - revoke all OTHER refresh tokens (current device keeps session)
     - audit log entry
10. Other devices: on next sync, see vault_version mismatch → force re-unlock
```

If anything fails mid-flight, the entire transaction rolls back — no partial state.
