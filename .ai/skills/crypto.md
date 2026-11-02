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

**Bind AD to immutable identifiers only** (row IDs, never email addresses or names an admin can edit). The user's private-key envelope — also the vault unlock canary — uses `trominal:v1:user_private_key:<user id>`; registration sends a client-generated lower-case ULID as the user ID so the AD is known before the row exists. Accounts created before this used the email address (`users.private_key_ad_version = 1`): unlock tries the ID AD, falls back to the email AD, and then re-binds the envelope once via `POST /api/v1/me/private-key/rebind`. The admin panel keeps the email read-only until that happens.

### KDF parameter bounds

KDF params come from the server and are untrusted. `isKdfParams` (client) and `SupportedKdfParams` (server) accept only `version: 1`, `alg: argon2id`, integer `memlimit` 64–256 MiB (KiB aligned), integer `opslimit` 3–10, `salt_len: 16`, `out_len: 32`, and no other keys; validate before deriving. A new parameter set gets a new `version`.

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

Implemented in `apps/client/src/features/vault/rotation.ts` and `App\Services\VaultRotationService`.

```
1. Client: prompt for current master password, new master password,
   login password and (if 2FA is on) a TOTP code
2. Client: derive old_vault_key, verify by opening the private-key canary
3. Client: generate new_kdf_salt (16 random bytes), derive new_vault_key
4. Client: fetch ALL personal records of EVERY vault type
5. Client: for every non-null <field>_ciphertext/<field>_nonce pair:
   decrypt with old_vault_key, re-encrypt with new_vault_key, same AD
6. Client: re-encrypt the private key (the canary!) with new_vault_key
7. Client: POST /api/v1/me/master-password/change with:
     {
       vault_version, current_password, two_factor_code?,
       current_refresh_token, new_kdf_salt, new_kdf_params,
       private_key_ciphertext, private_key_nonce,
       items: [{ type, id, updated_at, fields: { ..._ciphertext, ..._nonce } }, ...]
     }
8. Server: step-up (password + TOTP), then ATOMIC TX with row locks:
     - 409 if vault_version is stale, or items != current personal records
       (missing/extra/duplicate/foreign/team/deleted/modified since read)
     - 422 if a stored encrypted field is not replaced, other columns are
       sent, KDF params/salt/envelope are out of bounds, or the refresh
       token is not this user's active token
     - update records, kdf_salt, kdf_params, private-key envelope
     - bump user.vault_version
     - revoke all OTHER refresh and access tokens
     - audit log entry
9. Client: adopt new key + returned material (wipe old key); on failure
   keep the old key
10. Other devices: their tokens are revoked; a device that receives new
    material with a different salt/params locks and must re-unlock
```

If anything fails mid-flight, the entire transaction rolls back — no partial state. Vault writes take the same user-row lock and fail once their access token was revoked, so in-flight writes from other devices cannot land old-key ciphertext after a rotation.
