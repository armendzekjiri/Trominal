# Trominal Security Model

> Status: living document. Updated every release.

This document describes Trominal's threat model, what guarantees we make, what guarantees we explicitly do NOT make, and how to report vulnerabilities.

---

## 1. Threat Model

### 1.1 Adversaries we defend against

| Adversary                      | Capability                               | We protect against                                                                                 |
| ------------------------------ | ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Network attacker (passive)     | Sniffs traffic between client and server | ✅ TLS 1.3 + WSS only                                                                              |
| Network attacker (active)      | Can MitM connections                     | ✅ TLS + cert pinning option, HSTS                                                                 |
| Server-database thief          | Steals a DB dump                         | ✅ All secrets encrypted with vault key derived from user master password (server doesn't have it) |
| Server compromise (read-only)  | Reads files + memory at rest             | ✅ At-rest secrets encrypted; ⚠️ live web SSH sessions exposed (see §3)                            |
| Server compromise (active)     | Modifies code                            | ⚠️ Detection only — audit log + integrity checks. Not preventable by client.                       |
| Malicious self-hoster          | Operator of the Trominal instance        | ✅ For desktop client (backend not in SSH path); ⚠️ for web client (see §3)                        |
| Local malware on user's device | Reads memory, keylogger                  | ❌ Out of scope — same limitation as every password manager                                        |
| Stolen device, unlocked        | Has access to running session            | ⚠️ Auto-lock mitigates; recommend OS-level full-disk encryption                                    |
| Stolen device, locked          | No session access                        | ✅ Master password required to unlock vault                                                        |

### 1.2 Adversaries we do NOT defend against

- **Local malware with code execution.** If your OS is compromised, all bets are off. Use a clean machine.
- **Compromised AI provider.** If you BYOK to a sketchy AI endpoint, that endpoint can see your prompts (which may include shell context). Choose providers carefully.
- **Side-channel attacks** on the host CPU (Spectre, Meltdown, etc.). Out of scope.
- **Physical coercion.** No software defends against this.

---

## 2. Cryptographic Design

### 2.1 Master password → vault key

```
vault_key = Argon2id(
  password   = master_password,
  salt       = per-user 16-byte random (stored on server),
  memlimit   = 64 MiB,
  opslimit   = 3,
  output_len = 32 bytes
)
```

- Master password is **never** transmitted.
- Salt is public (stored on server, returned on login).
- Argon2id parameters are versioned in `kdf_params` JSON column for future migration.

### 2.2 Vault encryption

```
ciphertext = XChaCha20-Poly1305(
  key   = vault_key,
  nonce = 24-byte random per encryption,
  data  = plaintext_secret,
  ad    = "trominal:v1:" + resource_type + ":" + resource_id
)
```

- AEAD with associated data binds ciphertext to its resource — server can't move a host's password ciphertext to a different host.
- Nonce is random (XChaCha20 makes this safe for ≤ 2^80 messages).
- `vault_version` on the user record bumps on master password change → all clients re-derive on next sync.

### 2.3 Login authentication

- Login password hashed server-side with Argon2id (Laravel default parameters).
- Login password is **separate** from master password. Industry standard practice (Bitwarden, 1Password).
  - Reasoning: lets us authenticate API requests without ever touching the vault key.
  - Tradeoff: users have two passwords to remember. We provide a "use the same password" option but display a warning explaining the risk.

### 2.4 Implementation libraries

| Side       | Library                   | Purpose                     |
| ---------- | ------------------------- | --------------------------- |
| Browser/JS | `libsodium-wrappers-sumo` | All crypto                  |
| Rust       | `dryoc`                   | All crypto                  |
| PHP        | Native `sodium_*`         | Server-side validation only |

**CI cross-test:** every release runs the same plaintext through TS encrypt → Rust decrypt and Rust encrypt → TS decrypt. Asserts byte-equal outputs. Catches drift early.

---

## 3. Web SSH — Honest Tradeoffs

The web client cannot SSH directly from the browser (no raw TCP). It uses a **WebSocket proxy** through the backend. This means:

### What we do

- Encrypted private key is decrypted in the browser using vault key.
- Decrypted key sent over WSS (TLS 1.3) to backend, scoped to a single session.
- Backend opens an ephemeral worker process, uses the key to authenticate to the target SSH server, then bridges bytes between WSS and SSH.
- Worker process holds the key in memory only. Process exits on disconnect, OS reclaims memory.
- Audit log records: `(user, host, source IP, timestamp, duration)`. **Never the content.**

### What this means

- **Honest statement:** during an active web SSH session, your decrypted private key sits in the backend process memory. If the operator of that backend is malicious and modifies the Trominal code, they could exfiltrate keys.
- **Mitigation:** YOU are the operator. This is a self-hosted product. There is no third party between you and your data when you run your own instance.
- **For maximum security:** use the **desktop client**, which performs SSH natively in the Rust process on your own machine. Backend never sees the key in any form.
- **For self-hosters serving multiple users:** consider disabling web SSH (`WEB_SSH_ENABLED=false`) and requiring desktop clients.

We will never claim web SSH is zero-knowledge. It is "encrypted-in-transit + ephemeral-in-memory + operator-trusted."

---

## 4. Two-Factor Authentication

- **TOTP (RFC 6238)** required for sensitive operations.
- Secret encrypted at rest with app key.
- Backup codes generated at enrollment, hashed, single-use.
- Hardware key (WebAuthn) support planned.

---

## 5. Audit Logging

| Event                              | Logged   |
| ---------------------------------- | -------- |
| Login (success/failure)            | ✅       |
| Vault item read                    | ✅       |
| Vault item created/updated/deleted | ✅       |
| Host connection attempt            | ✅       |
| Master password change             | ✅       |
| 2FA enable/disable                 | ✅       |
| Device added/revoked               | ✅       |
| Admin setting change               | ✅       |
| **Terminal session content**       | ❌ Never |
| **Plaintext secrets**              | ❌ Never |

Retained 90 days by default. Configurable per self-hoster.

---

## 6. Server Hardening Checklist (for self-hosters)

- [ ] Run behind TLS 1.3 (Caddy in our docker-compose handles this automatically)
- [ ] HSTS enabled
- [ ] Firewall: expose only 443. Postgres, Redis, Reverb stay internal.
- [ ] Set `APP_KEY` (Laravel handles via `php artisan key:generate`)
- [ ] Strong DB password
- [ ] `ALLOWED_ORIGINS` set to your client domains only
- [ ] Regular backups of Postgres
- [ ] OS auto-updates enabled
- [ ] Monitor `audit_log` for anomalies

---

## 7. Reporting Vulnerabilities

**Do not file public issues for security bugs.**

Email: `security@<TBD-your-domain>` (set this up before public launch).

PGP key: TBD.

We aim to respond within 48 hours and disclose within 90 days of a fix being available, coordinated with the reporter.

---

## 8. Changelog of Security-Relevant Changes

Tracked in [CHANGELOG.md](CHANGELOG.md) with the `security:` prefix on every relevant entry.
