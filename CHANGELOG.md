# Changelog

All notable changes to Trominal are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Security-relevant changes are tagged `security:`.

## [Unreleased]

### Added — Phase 6B: SFTP

- Dual-pane SFTP browser at `/sftp` matching `.ai/design/screens-tools.jsx`:
  local file pane on the left, remote pane on the right, transfer queue
  pinned to the bottom.
- Tauri commands `sftp_list / sftp_mkdir / sftp_remove / sftp_rename /
sftp_upload / sftp_download / sftp_cancel / sftp_local_list /
sftp_local_home`. Implementation shells out to the system `sftp` binary
  in batch mode (`sftp -b -`) so the same OpenSSH config / auth chain that
  Phase 5 negotiates is reused — no parallel Rust SSH library introduced.
- Transfer queue with started/done/error events streamed over
  `sftp://transfer`. Cancelling a transfer kills the in-flight `sftp`
  child process.
- Web build shows a "Desktop only for v0.1" placeholder; the web SFTP
  proxy lands alongside the wider browser SSH stack in a follow-up phase.

### Added — Phase 4: client foundation

- `@trominal/crypto` package with libsodium-backed Argon2id KDF and
  XChaCha20-Poly1305 AEAD, mandatory associated-data binding, plus
  Ed25519/X25519 key generation and key-buffer wipe helpers.
- Cross-language parity test crate (`packages/crypto/parity`) that uses
  pure-Rust RustCrypto crates (`argon2`, `chacha20poly1305`) to verify
  byte-equal output against the JS implementation. Wired into CI as a
  dedicated job.
- Typed auth methods on `@trominal/api-client` (register, login, refresh,
  logout, /me, 2FA enable/verify/disable, forgot/reset password,
  /api/server-info) with strict request/response shapes derived from
  `apps/backend/openapi.yaml`.
- Tauri secure-storage commands (`secure_set` / `secure_get` /
  `secure_delete`) backed by the OS keychain via the `keyring` crate;
  web fallback uses `sessionStorage` for the refresh token and
  `localStorage` for the (non-secret) API base URL.
- Auth UI matching `.ai/design/screens-auth.jsx`: first-launch / connect,
  register (with master-password derivation, X25519 keypair generation,
  encrypted private-key upload), sign-in, 2FA setup, 2FA challenge,
  forgot password, reset password, vault unlock with canary decryption.
- Permission-aware app shell with sidebar navigation gated by
  `/api/v1/me` permissions; placeholder pages for hosts, snippets,
  identities, tunnels, and settings.
- Vault Zustand store with auto-lock idle timer (default 15 min) that
  zeroes the key buffer in place on lock or logout.

### Added

- Initial project scaffold and AI agent instructions
- Project brief covering: client app (Tauri+React) + Filament admin panel
- Roles & permissions design via Spatie Laravel Permission
- Teams design with per-team symmetric key wrapped per member (Phase 8)
- Single-user mode flow: first user gets `admin` + `user` roles atomically
- Skill files for Claude Code / Cursor / GitHub Copilot covering:
  Laravel backend, Filament admin, Tauri+React client, crypto, testing, git workflow
