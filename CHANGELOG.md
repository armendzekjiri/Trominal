# Changelog

All notable changes to Trominal are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Security-relevant changes are tagged `security:`.

## [Unreleased]

### Added — Phase 8A: Teams backend foundation

- Backend `teams` / `team_members` schema with ULIDs, encrypted ciphertext
  casts, member-specific wrapped team keys, team roles, and `key_version`
  tracking for rotation.
- Team API endpoints for team CRUD, user public-key lookup, member add/list,
  role changes, and removal with mandatory wrapped-key rotation payloads for
  every remaining member.
- Typed `@trominal/api-client` team DTOs and methods, plus OpenAPI schemas for
  encrypted team metadata and wrapped team-key membership records.
- Pest coverage for encrypted-at-rest storage, permission failures, team role
  authorization, final-owner protection, audit logs, and member-removal key
  rotation validation.

### Added — Phase 7B: AI inside the terminal & snippet generation

- **Inline command suggestions** in the terminal: `Ctrl+Space` triggers the
  configured AI provider to suggest the next shell command. The result is
  rendered as a floating overlay positioned at the xterm cursor; **Tab**
  accepts (writes through the SSH session), **Esc** dismisses. Manual
  trigger keeps us out of conflicts with `vim`/`tmux`/sudo prompts that an
  auto-debounced strategy would lose. Gated by `features.inlineSuggestions`
  - the `ai.use` permission.
- **Right-click "Explain command"** context menu over the terminal pane.
  Uses the active selection (or falls back to the last visible non-blank
  line). Choosing it opens the Ask AI panel pre-loaded with `/explain
<text>` and auto-submits via a new `pendingPrompt` prop on `AskAiPanel`.
  Gated by `features.explainCommand`.
- **AI-generated snippets**: a Generate button in `SnippetsPage` opens a
  popover, asks the configured provider for a `{title, body, tags}` JSON
  response (with `{{variable}}` placeholders), and pre-fills the form for
  user review. The parser tolerates fenced blocks, missing fields, and
  free-form responses; the user always confirms before saving.
- 18 new Vitest cases (69 total) cover snippet-prompt JSON parsing
  (clean / fenced / fallback / malformed), suggestion sanitisation (code
  fence stripping, prompt-token removal, multi-line collapse), and the
  `lastCommandLine` fallback for context-menu Explain.

### Added — Phase 7A: AI foundation + Settings + Ask AI panel

- **Vault scaffolding** for the existing `ai_settings` table: `AiSettingsItem`
  / `AiSettingsInput`, `decryptAiSettings` / `encryptAiSettingsInput`, and
  `useAiSettings` / `useSaveAiSettings` hooks. Same encryption + AD pattern
  as host credentials; the singleton row is surfaced as `AiSettingsItem | null`
  rather than an array. Endpoint and feature toggles ride together inside the
  encrypted `settings` JSON blob.
- **Adapter layer** in `apps/client/src/features/ai/adapters/`: `AnthropicAdapter`,
  `OpenAICompatibleAdapter` (covers OpenAI / Ollama / OpenRouter / vLLM / any
  OpenAI-compatible server), and `CustomAdapter`. All three implement the
  same `chat(request, config): AsyncIterable<ChatChunk>` interface and stream
  via a small SSE parser. Calls go directly from the client to the provider
  per the BYOK constraint — Trominal's backend never sees the API key.
- **Settings page** (`/settings`) replaces the placeholder with a sidebar
  layout (Connection / Account / **AI** / Appearance / Shortcuts /
  Notifications / Advanced). Only the AI tab is fully implemented in 7A; the
  others render a "coming in Phase 9" stub. AI tab: 4-button provider grid,
  endpoint / model fields, masked API key with reveal, four feature toggles,
  Test connection button.
- **Ask AI panel** in `TerminalPage`: 380px slide-in with streaming chat,
  optional last-50-lines terminal context, and `/explain` `/fix` `/diagnose`
  shortcut prompts. Toggle button gated behind `useAuth().hasPermission('ai.use')`.
- 14 new Vitest cases (51 total) for the SSE parser, OpenAI/Anthropic
  adapter request shaping + streaming, AiSettings encrypt/decrypt round-trip,
  and recent-lines extraction from xterm scrollback.

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
