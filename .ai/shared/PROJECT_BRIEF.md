# Trominal — Project Brief

> **Authoritative project specification.** All AI agents (Codex, Claude Code, Cursor, GitHub Copilot) reference this file. If anything elsewhere contradicts this, this file wins.

---

## 0. Locked Decisions

| Decision            | Value                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Product name        | **Trominal**                                                                                                                |
| Frontend framework  | **Tauri 2 + React + TypeScript + Vite**                                                                                     |
| Web SSH             | **Enabled** — backend WebSocket proxy, full-featured web client                                                             |
| Registration mode   | **Single-user** by default (first user becomes admin, registration auto-closes). Admin can re-open it from the admin panel. |
| Backend             | **Laravel 13** (API for clients + Filament admin panel)                                                                     |
| Admin panel         | **Filament 3** (server-side, separate from client app)                                                                      |
| Roles & permissions | **Spatie Laravel Permission**                                                                                               |
| Teams               | **First-class** — shared hosts, snippets, identities with proper team-key crypto                                            |
| Database            | PostgreSQL 16                                                                                                               |
| License             | AGPL-3.0                                                                                                                    |

---

## 1. What We're Building

**Trominal** — an open-source, self-hostable, cross-platform Termius alternative.

### Two distinct user-facing surfaces

1. **Client App** (Tauri + React, used by everyone)
   - SSH terminals, snippets, tunnels, SFTP, AI integration
   - The thing you live in day-to-day
   - Identical on web, macOS, Windows, Linux
   - End-users (developers) use this 99% of the time

2. **Admin Panel** (Filament on the Laravel backend, used by admins only)
   - User management, team management, roles & permissions
   - Registration mode toggle, instance settings
   - Audit log viewer, invite codes, system stats
   - Lives at `https://your-instance.example.com/admin`
   - Server operators use this to run the instance
   - **End-users never need to see this.**

This separation is intentional: the client app stays focused on SSH workflow; the admin panel is for operators managing the instance.

---

## 2. Non-Negotiable Principles

1. **Security first.** Zero-knowledge architecture: the server NEVER sees plaintext SSH keys, passwords, or AI API keys. All sensitive data is encrypted client-side before upload.
2. **Self-hostable.** No hardcoded API URL anywhere in the clients. First-launch screen asks for the API base URL.
3. **BYOK AI.** No vendor lock-in. User configures provider, endpoint, key, and model. AI calls go directly from the client to the provider, never through our backend.
4. **One UI, all platforms.** Web build and desktop build share the same React codebase.
5. **Open source.** AGPL-3.0. Public repo from day one.
6. **Admin lives on the server.** Instance management is a Filament panel, not a client feature. Keeps the client focused, the admin powerful.

---

## 3. Tech Stack (locked)

### Backend

- **Laravel 13** (latest)
- **Filament 3** for admin panel (Blade-based, separate from API)
- **PostgreSQL 16**
- **Redis 7** (cache, sessions, queue, rate limit store)
- **Laravel Sanctum** for API auth
- **Laravel Reverb** for WebSocket (SSH proxy + live sync events)
- **Laravel Horizon** for queue monitoring
- **Spatie Laravel Permission** for roles and permissions
- **PragmaRX/Google2FA** for TOTP
- **phpseclib/SSH2** for the server-side SSH proxy (web client only)
- **Pest** for tests, **Larastan** level 8

### Client (desktop + web)

- **Tauri 2** (Rust shell)
- **React 18 + TypeScript + Vite**
- **Tailwind CSS + shadcn/ui** (matching termcn.dev aesthetic)
- **xterm.js** for terminal rendering
- **russh** for native SSH on desktop
- **libsodium**: `libsodium-wrappers-sumo` (browser/JS) and `dryoc` (Rust)
- **Zustand** for app state, **TanStack Query** for server state
- **react-router-dom** for routing
- **Vitest + Playwright** for tests

### Mobile (future, not now)

- Tauri 2 iOS/Android — same React codebase

### Infra

- **Docker + docker-compose** for self-hosters
- **GitHub Actions** for CI
- **Tauri auto-updater** for desktop releases

---

## 4. Repository Layout (monorepo, pnpm workspaces)

```
trominal/
├── .ai/                          # AI agent instructions
├── apps/
│   ├── backend/                  # Laravel 13 — API + Filament admin
│   │   ├── app/
│   │   │   ├── Filament/         # Admin panel resources, pages, widgets
│   │   │   ├── Http/Controllers/Api/V1/
│   │   │   ├── Models/
│   │   │   ├── Policies/
│   │   │   └── Services/
│   │   └── routes/
│   │       ├── api.php
│   │       └── api_v1.php
│   └── client/                   # Tauri + React (the SSH app)
│       ├── src/
│       ├── src-tauri/
│       └── public/
├── packages/
│   ├── crypto/                   # Shared crypto utilities (TS)
│   ├── ssh-transport/            # Native vs WebSocket SSH abstraction
│   ├── api-client/               # Typed SDK from OpenAPI
│   └── ui/                       # Shared shadcn components
├── docker/
├── docs/
└── (root config files)
```

---

## 5. Roles, Permissions & Teams

### 5.1 Default roles (seeded on install)

| Role      | Default permissions                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------- |
| **admin** | Everything: manage users, teams, roles, permissions, instance settings, view all audit logs                         |
| **user**  | Manage own resources (hosts, snippets, identities, tunnels), use AI, change own settings                            |
| **guest** | Read-only access to assigned team resources (no SSH connect, no edits) — useful for stakeholders watching a session |

Admins can create custom roles via the Filament panel. Permissions are seeded but extensible.

### 5.2 Permissions (seeded)

```
# User-level
hosts.create, hosts.read, hosts.update, hosts.delete, hosts.connect
snippets.create, snippets.read, snippets.update, snippets.delete
identities.create, identities.read, identities.update, identities.delete
tunnels.create, tunnels.read, tunnels.update, tunnels.delete
sftp.connect, sftp.read, sftp.upload, sftp.download, sftp.delete
ai.use
audit.read.own

# Team-level
teams.create, teams.read.own, teams.update.own, teams.delete.own
teams.members.invite, teams.members.remove
teams.roles.assign

# Admin-level
admin.users.manage
admin.teams.manage
admin.roles.manage
admin.permissions.manage
admin.settings.manage
admin.audit.read.all
admin.invites.manage
```

### 5.3 Teams

A **team** is a shared workspace. Members of a team can see and use shared hosts, snippets, identities, and tunnels.

#### Team membership

Each user-team relationship has a **team role**: `owner`, `admin`, `member`, `viewer`. Independent of the global instance role. (Spatie Permission supports this with team scopes.)

#### Team encryption (the tricky part)

Teams cannot use a single user's master-password-derived key, since each user has a different one. Solution: **per-team symmetric key wrapped with each member's public key.**

```
Per team:
  team_key = random 32 bytes (XChaCha20 key)

Per member:
  member_keypair = (member_pk, member_sk)
    - generated client-side at signup
    - sk encrypted with vault_key (master password derived)
    - pk stored plaintext on server

  team_key wrapped with member_pk → stored in team_members table
```

When a user joins a team:

1. An existing team member (owner/admin) decrypts the team_key with their own sk
2. Re-wraps it with the joining member's pk
3. Stores the new wrapped key in `team_members.wrapped_team_key`

When a team resource is encrypted:

1. Use `team_key` instead of personal `vault_key`
2. AD includes team scope: `"trominal:v1:team_host_credential:cred_id:team_id"`

When a team member is removed:

1. Generate a new team_key (key rotation)
2. Re-encrypt all team resources with new key
3. Re-wrap new key for all remaining members
4. Old key invalid — removed member cannot decrypt anything new

This is the same pattern Bitwarden Organizations and 1Password Teams use. It's the standard for multi-user encrypted vaults.

> **Note:** team encryption is a complex feature. **Phase 8 (after v0.1.0).** Initial release is single-user-vault only with personal resources. Teams ship in v0.2.

### 5.4 Permissions checking

- **API:** Spatie middleware on routes (`->middleware('can:hosts.connect')`) and Policies for object-level checks
- **Client app:** receives the user's effective permissions in `/api/v1/me` response and uses them to gate UI (hide buttons, etc.)
- **Filament:** uses Spatie integration for resource visibility and actions

---

## 6. Filament Admin Panel

### 6.1 Access

- URL: `https://<your-instance>/admin`
- **Auth:** Filament login form, requires user to have `admin` role
- Same Laravel users table; the panel uses standard Filament auth gates
- Non-admin users get a 403 with a redirect to the API root

### 6.2 Pages and resources (v0.1)

| Resource / Page         | Purpose                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard**           | Stats: total users, active sessions, recent registrations, audit log feed                                                                   |
| **Users**               | List, create, edit, suspend, delete users. Trigger password reset emails. Assign roles.                                                     |
| **Roles & Permissions** | CRUD roles. Assign permissions to roles. (Spatie integration.)                                                                              |
| **Teams**               | List, create, delete teams. View members. (Membership management can also happen via API by team owners — see §5.3.)                        |
| **Invites**             | Generate / revoke invite codes when registration mode is `invite`                                                                           |
| **Settings**            | Toggle registration mode (`single`/`open`/`invite`/`closed`), set instance name, configure email, toggle features (web SSH, AI proxy, etc.) |
| **Audit Log**           | Searchable, filterable audit log. Filter by user, action, resource, date range. Read-only.                                                  |
| **System Health**       | Queue status (Horizon link), Redis status, DB version, Reverb status                                                                        |

### 6.3 What admin panel does NOT do

- ❌ It does not manage personal vault items (hosts, credentials, etc.) — those are user-private and encrypted with the user's key. The server can't decrypt them anyway.
- ❌ It does not start SSH sessions on behalf of users. Operators are not users.
- ❌ It does not show plaintext audit content — only metadata.

### 6.4 First-time setup flow

1. Self-hoster runs `docker compose up -d`
2. First user visits the **client app** (web or desktop), enters their server URL, registers
3. That first user is automatically granted the `admin` role and `single` mode flips off (atomic transaction)
4. The new admin can now visit `https://<instance>/admin` and log in with the same credentials
5. From there: enable registration, create teams, invite users, etc.

The first user is a **dev user** (their personal vault works) AND an **admin** (can use the panel). They use the client app for SSH work and the admin panel for instance management.

### 6.5 Filament conventions in this project

- Resources live in `app/Filament/Resources/`
- Custom pages in `app/Filament/Pages/`
- Widgets in `app/Filament/Widgets/`
- Admin panel routes auto-registered via `AdminPanelProvider`
- Filament uses session auth (separate cookie from API Sanctum tokens — same user, different auth guard)
- All admin-panel actions write to the audit log just like API actions

---

## 7. Security Architecture (READ TWICE)

### 7.1 Zero-Knowledge Vault

- On signup, user chooses a **master password** (min 12 chars, zxcvbn score ≥ 3).
- Client derives **vault key** with **Argon2id** (memlimit 64 MiB, opslimit 3, random 16-byte per-user salt, 32-byte output).
- Salt + KDF params stored on server. Master password NEVER sent to server.
- Each personal secret encrypted with **XChaCha20-Poly1305** with random 24-byte nonce.
- Server stores: `{ ciphertext, nonce, kdf_salt, kdf_params, version }`.
- New device flow: log in → fetch salt + ciphertext → enter master password → derive key → decrypt locally.
- Vault key in memory only. Auto-lock after configurable idle timeout (default 15 min).

### 7.2 Per-user keypair (for team membership, Phase 8)

- At signup, client generates an **Ed25519 keypair** (or X25519 for encryption — TBD in Phase 8).
- Public key stored plaintext on server.
- Private key encrypted with vault key, stored as ciphertext on server.
- Used to wrap/unwrap team keys.
- _Generated even for solo users_ so they can be added to teams later without a re-keying flow.

### 7.3 Authentication

- Login password hashed server-side with **Argon2id** (Laravel default).
- **Sanctum** issues access tokens (15 min) + refresh tokens (7 days, rotating, stored hashed).
- **TOTP 2FA** mandatory for: viewing/exporting vault items, changing master password, deleting account, accessing admin panel.
- Device list with revoke per-device. Revoke = invalidate refresh-token family.
- Filament admin panel uses session auth (Laravel default), gated by `admin` role.

### 7.4 Single-User Mode (default)

- On fresh install, registration is open ONLY until first user completes signup.
- That user automatically gets `admin` role and `user` role (Spatie supports multiple).
- Backend sets `app_settings.registration_open=false` atomically in the same transaction.
- Subsequent registration attempts return 403.
- Admin can re-open via Filament → Settings, or via API `PUT /api/v1/admin/settings`.
- Env var `REGISTRATION_MODE` overrides initial state if set explicitly.

### 7.5 Transport & Server Hardening

- TLS 1.3 only. HSTS preload-ready.
- Strict CORS — `ALLOWED_ORIGINS` env allowlist.
- Rate limiting: 5 login attempts per 15 min per IP + per email. Generic API throttle 60/min.
- Audit log: every vault access, every host connection attempt, every admin action, retained 90 days (configurable).
- Vault DB columns also wrapped with Laravel `encrypted` cast — defense in depth.
- App key, DB creds via env vars only. Never commit `.env`.
- Security headers: CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy.
- Filament admin panel rate-limited and behind 2FA.

### 7.6 SSH Connections — Two Transport Modes

**Desktop (Tauri):**

- SSH 100% in Rust process via `russh`.
- Plaintext key decrypted in JS, passed to Rust via Tauri command, JS reference wiped.
- Rust holds key in memory only for session duration. `zeroize` crate clears on disconnect.
- Direct TCP from user's machine to target host. Backend not in the loop.

**Web (browser):**

- Plaintext key decrypted in browser, sent over WSS to backend SSH proxy.
- Backend opens SSH session via `phpseclib` from a sandboxed Reverb worker.
- Backend forwards bytes between WebSocket and SSH session.
- Backend never persists the key. In-memory only. Connection dies → key zeroized → session terminated.
- WebSocket auth: short-lived (30 sec) connection token issued by API, single-use, IP-bound.
- Operator can disable web SSH via env (`WEB_SSH_ENABLED=false`).

> See `SECURITY.md` for the full threat model and honest tradeoffs of web SSH.

### 7.7 Host Fingerprint Verification

- Fingerprints stored encrypted in vault, verified on every connect.
- First-connect TOFU prompt with full fingerprint + algorithm.
- Mismatch = blocked with clear UI warning. No silent override.

### 7.8 What the Server CAN See

- Email, hashed login password, KDF salt, ciphertexts, nonces.
- Public keys (per-user), wrapped team keys.
- Host metadata (label, address, port, username — non-secret).
- Audit log entries.
- During web SSH: traffic between browser↔backend (WSS) and backend↔target (SSH).
- All admin-panel data (users, roles, teams, settings) — admins are operators, this is by design.

### 7.9 What the Server CANNOT See

- SSH private keys (at rest), host passwords, AI API keys, snippet contents (encrypted at rest).
- Master password, vault key, per-user private keys (at rest).
- Team keys (encrypted at rest, wrapped per-member).
- Plaintext anything when desktop client is used — backend is purely a sync layer.

---

## 8. Self-Hosting Model

### 8.1 First-Launch Flow (client)

1. Splash → "Connect to your Trominal server"
2. Input: **API Base URL** (e.g., `https://shell.mydomain.com`)
3. Client hits `GET /api/server-info`:
   ```json
   {
     "name": "MyOrg Trominal",
     "version": "0.1.0",
     "registration_mode": "single",
     "registration_open": true,
     "features": { "web_ssh": true, "ai_proxy": false, "teams": false },
     "min_client_version": "0.1.0"
   }
   ```
4. URL persisted to local secure storage. Editable in Settings → Connection.

### 8.2 Registration Modes

- `single` _(default)_ — first user becomes admin, then closes
- `open` — anyone can sign up
- `invite` — admin generates invite codes via Filament
- `closed` — admin creates users via Filament

### 8.3 Deployment

`docker-compose.yml` services:

- `app` (Laravel + PHP-FPM — serves both API and Filament)
- `reverb` (WebSocket server)
- `queue` (Horizon worker)
- `postgres`
- `redis`
- `caddy` (auto-TLS reverse proxy)
- `static` (optional — serves the web client build)

One `.env.example` documented in `docs/SELF_HOSTING.md`. Single command: `docker compose up -d`.

---

## 9. Database Schema (high level)

```
users                  (id, email, password_hash, kdf_salt, kdf_params, two_fa_secret_enc,
                        two_fa_enabled, public_key, private_key_ciphertext, private_key_nonce,
                        vault_version, suspended_at, created_at, ...)

devices                (id, user_id, name, fingerprint, last_seen, revoked_at)
refresh_tokens         (id, user_id, token_hash, family_id, expires_at, revoked_at)

# Spatie permission tables (auto-generated by package)
roles, permissions, model_has_roles, model_has_permissions, role_has_permissions

# Teams (Phase 8)
teams                  (id, created_by_user_id, name_ciphertext, name_nonce,
                        key_version, deleted_at, created_at, ...)
team_members           (id, team_id, user_id, role[owner|admin|member|viewer],
                        wrapped_team_key_ciphertext, wrapped_team_key_nonce,
                        key_version, created_at, ...)

# Personal resources
groups                 (id, user_id, team_id?, name, parent_id, color, sort_order)
hosts                  (id, user_id, team_id?, label, address, port, username, group_id,
                        color, tags, host_fingerprint_enc, default_identity_id, ...)
host_credentials       (id, host_id, kind[password|key|identity_ref], ciphertext, nonce, scope[user|team])
identities             (id, user_id, team_id?, label, public_key, private_key_ciphertext, nonce)
snippets               (id, user_id, team_id?, title, body_ciphertext, nonce, tags)
tunnels                (id, host_id, kind[local|remote|dynamic], local_port, remote_host, remote_port, autostart)
ai_settings            (id, user_id, provider, endpoint, model, api_key_ciphertext, nonce, features_enabled jsonb)

# Operations
audit_log              (id, user_id, action, resource_type, resource_id, ip, ua, metadata jsonb, created_at)
invites                (id, code_hash, role, team_id?, created_by, used_by, expires_at)
app_settings           (key, value)
ws_session_tokens      (id, user_id, host_id, token_hash, ip, expires_at, used_at)
```

`team_id` columns are nullable until Phase 8. All `*_ciphertext` columns wrapped with Laravel `encrypted` cast.

---

## 10. API Surface (REST, versioned `/api/v1`)

### Public

- `GET  /api/server-info`
- `GET  /api/health`
- `POST /api/v1/auth/register` (gated by registration mode)
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/2fa/verify`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`

### Authenticated (any user)

- `GET    /api/v1/me` (returns user + roles + permissions)
- `POST   /api/v1/me/2fa/enable`
- `POST   /api/v1/me/2fa/disable`
- `GET    /api/v1/me/devices`
- `DELETE /api/v1/me/devices/{id}`
- `POST   /api/v1/me/master-password/change`
- `GET    /api/v1/vault/salt`
- `GET    /api/v1/hosts` `POST/PUT/DELETE`
- `GET    /api/v1/groups` `POST/PUT/DELETE`
- `GET    /api/v1/snippets` `POST/PUT/DELETE`
- `GET    /api/v1/identities` `POST/PUT/DELETE`
- `GET    /api/v1/tunnels` `POST/PUT/DELETE`
- `GET    /api/v1/ai-settings` `PUT`
- `GET    /api/v1/audit-log` (own entries only unless admin)
- `POST   /api/v1/sync` (delta sync, `since` cursor)
- `POST   /api/v1/ws/ssh-token` (issue short-lived WS token)

### Teams (Phase 8)

- `GET    /api/v1/teams`
- `POST   /api/v1/teams`
- `GET    /api/v1/teams/users/lookup?email=...` (returns user public key)
- `GET    /api/v1/teams/{id}`
- `PATCH  /api/v1/teams/{id}`
- `DELETE /api/v1/teams/{id}`
- `GET    /api/v1/teams/{id}/members`
- `POST   /api/v1/teams/{id}/members`
- `PATCH  /api/v1/teams/{id}/members/{member_id}`
- `DELETE /api/v1/teams/{id}/members/{member_id}` (requires wrapped keys for every remaining member)
- Resources can be filtered by team: `GET /api/v1/hosts?team={team_id}`

### WebSocket

- `WSS /ws/ssh?token=...` (web SSH proxy)
- `WSS /ws/sync` (live sync events)

### Admin API (mostly used by Filament internally; also exposed for advanced automation)

- `GET/POST/PUT/DELETE /api/v1/admin/users`
- `GET/POST/PUT/DELETE /api/v1/admin/teams`
- `GET/POST/PUT/DELETE /api/v1/admin/roles`
- `GET/PUT             /api/v1/admin/permissions`
- `GET/PUT             /api/v1/admin/settings`
- `GET/POST            /api/v1/admin/invites`
- `GET                 /api/v1/admin/audit-log`

OpenAPI 3.1 spec at `apps/backend/openapi.yaml`. Client SDK auto-generated to `packages/api-client`.

---

## 11. Phased Build Plan

> Complete each phase fully, run tests, commit, then ask before moving on.

### Phase 0 — Foundation

- Initialize monorepo (pnpm workspaces).
- Create `apps/backend` with `composer create-project laravel/laravel "^13.0"`.
- Create `apps/client` with `pnpm create tauri-app` (React + TS template).
- Add `docker/docker-compose.dev.yml` with Postgres + Redis.
- Wire up GitHub Actions: lint + test on PR.
- Add `LICENSE` (AGPL-3.0), `README.md`, `CONTRIBUTING.md`, `.editorconfig`, `.gitignore`.
- Configure ESLint, Prettier, Pint, Larastan level 8, strict TS.
- Husky + lint-staged for pre-commit.
- **Deliverable:** `docker compose -f docker/docker-compose.dev.yml up` boots backend on `localhost:8000`. `pnpm tauri dev` launches desktop app with placeholder. CI green.

### Phase 1 — Backend Auth + Single-User Mode + Spatie Permission

- Install Spatie Permission package, publish migrations.
- Migrations: users (with `public_key`, `private_key_*` columns from day one), devices, refresh_tokens, audit_log, invites, app_settings, ws_session_tokens.
- Seeders: default roles (`admin`, `user`, `guest`) + default permissions.
- Sanctum setup with refresh-token rotation.
- Endpoints: register (atomic single-user closeout, assigns `admin` + `user` roles), login, refresh, logout, me (returns roles + permissions).
- TOTP 2FA enable/verify/disable.
- Forgot/reset password (email queued — log driver in dev).
- Rate limiting + audit log middleware.
- `GET /api/server-info` and `GET /api/health`.
- Pest tests including the single-user race-condition.

### Phase 2 — Filament Admin Panel

- Install Filament 3 (`composer require filament/filament`).
- Configure `AdminPanelProvider` — gate by `admin` role.
- 2FA enforcement on admin panel access.
- Filament Resources: `UserResource`, `RoleResource`, `PermissionResource`, `InviteResource`.
- Custom pages: `Settings` (registration mode, instance name, feature toggles), `AuditLog` (filterable, read-only), `SystemHealth`.
- Dashboard widgets: total users, active sessions, recent registrations, audit feed.
- Spatie Permission integration (Filament has a community plugin or we can wire Resources directly).
- All Filament actions write audit log entries.
- Pest tests for Filament page authorization (non-admin gets 403).
- **Deliverable:** admin can log in to `/admin`, manage users/roles/permissions, toggle registration mode.

### Phase 3 — Vault Backend

- Migrations: hosts, groups, snippets, identities, tunnels, ai_settings, host_credentials.
- All ciphertext fields use Laravel `encrypted` cast.
- CRUD endpoints (Policies + Spatie permission checks: `can:hosts.create` etc.).
- Delta sync endpoint with `updated_at` cursor + soft-delete tombstones.
- Master-password-change: client uploads bulk re-encrypted ciphertexts in one transaction; server bumps `vault_version`, invalidates other sessions.
- OpenAPI spec generation.
- Generate `packages/api-client` from spec.
- Pest tests including permission-denial cases.

### Phase 4 — Client Foundation + Auth UI

- Implement `packages/crypto` with libsodium: `deriveVaultKey()`, `encrypt()`, `decrypt()`, `generateNonce()`, `generateEd25519KeyPair()`, `generateX25519KeyPair()`.
- **Critical:** cross-test against `dryoc` in Rust to guarantee identical ciphertexts. CI test required.
- Tauri secure storage wrapper for: API URL, refresh token, encrypted vault cache.
- Web equivalent using IndexedDB + WebCrypto for at-rest cache.
- First-launch "Connect to server" screen.
- Login / register / 2FA / forgot password flows.
- Master password setup → derives vault key → generates user keypair → encrypts private key → uploads.
- Auto-lock after idle timeout.
- shadcn theme matching termcn.dev (dark default).
- App shell: sidebar (Hosts, Terminal, Snippets, Identities, Tunnels, SFTP, Settings) + main pane.
- Permission-aware UI: hide buttons the user can't use, based on `/api/v1/me` permissions.
- **Deliverable:** sign up as first/admin user, set master password, log in to client AND admin panel. Web build and desktop build identical.

### Phase 5 — Hosts, Snippets, Identities, Terminal

- Hosts CRUD UI with groups (tree), search, tags, color labels.
- Snippets CRUD UI with markdown preview + variable substitution (`{{var}}`).
- Identities UI: import (paste/file), generate (ed25519 + rsa-4096), view public key, copy.
- `packages/ssh-transport` abstraction (Native + WebSocket).
- Backend WebSocket SSH proxy (Reverb + phpseclib worker).
- xterm.js with PTY resize, copy/paste, true colors, ligatures.
- Tabs for multiple sessions.
- Disconnect / reconnect with memory zeroize.

#### Phase 5.x implementation notes

These notes describe the local v0.1 implementation already merged after Phase 5. They are authoritative for agents continuing from the current repository state.

- Phase 5.1 added the local desktop shell surface.
- Phase 5.2 changed desktop SSH to run through the system `ssh` binary in a Tauri PTY so password and keyboard-interactive auth work in the terminal. `russh` remains the locked long-term native SSH engine, but system `ssh` is the current v0.1 desktop transport.
- Phase 5.3 added host-attached encrypted SSH identities, generated OpenSSH-compatible Ed25519 and RSA-4096 identities, and terminal auth through attached identities.
- Attached key bootstrap happens on host save, not during terminal connect: Trominal tests the selected key first, prompts for the server password if needed, tries `ssh-copy-id`, and falls back to a manual `authorized_keys` install command.
- Existing RSA identities exported as PKCS#8 are normalized client-side before use, and host credential switching keeps one current credential per host to avoid stale key selection.
- Web SSH proxy and multi-session tabs remain planned follow-up work; the current v0.1 priority is reliable desktop SSH, then Phase 6 Tunnels/SFTP.

### Phase 6 — Tunnels and SFTP

Tunnels and SFTP are separate product areas because they serve different workflows. Do not combine them into one page.

#### Phase 6A — Tunnels

- Tunnel manager UI: local, remote, SOCKS.
- Desktop v0.1: real port-forwards through the current system `ssh` transport. Later replace the engine with `russh` when the native SSH engine is implemented.
- Web: tunneling proxied through backend with operator-configurable allow/deny.

#### Phase 6B — SFTP

- Separate sidebar item and route from Tunnels (`/sftp`).
- SFTP browser: dual-pane file manager, drag-drop.
- Desktop v0.1: use the current host identity/auth model and a native file-transfer bridge.
- Web: SFTP proxied through backend with the same operator-configurable allow/deny model as web tunneling.

### Phase 7 — AI Integration (BYOK)

- Settings → AI: provider, endpoint, model, API key (encrypted), feature toggles.
- Adapter pattern: `OpenAICompatibleAdapter`, `AnthropicAdapter`, `CustomAdapter`.
- Inline command suggestions in terminal (debounced, opt-in).
- "Ask AI" panel.
- "Explain this command" right-click action.
- Snippet generation from natural language.
- All AI calls direct from client to provider.

### Phase 8 — Teams

- Migrations: teams, team_members.
- API: team CRUD, member invite/remove/role-change.
- Filament: team management page.
- Client: team switcher in sidebar; resources scoped by team.
- Crypto: team-key wrap/unwrap with user keypairs.
- Member removal triggers team-key rotation.
- Pest tests for the rotation flow.

#### Phase 8A implementation notes

- Backend team foundation is implemented on `phase/8-teams`: `teams` and `team_members` use ULIDs, encrypted casts for ciphertext columns, per-member `wrapped_team_key_*`, and a monotonically increasing `key_version`.
- API endpoints now cover team create/read/update/delete, user public-key lookup by email, member add/list/role-change/remove, and removal-time key rotation payload validation.
- Team role rules are enforced in `TeamService`: owners/admins can manage members, only owners can create another owner or delete a team, and the final owner cannot be demoted or removed.
- Removing a member requires the client to submit a new wrapped team key for every remaining member. The server never sees the plaintext team key and only stores wrapped ciphertexts.
- Every state-changing team action writes an audit log entry. `TeamsTest` covers encrypted-at-rest assertions, membership authorization, owner preservation, and rotation validation.

#### Phase 8B implementation notes

- `packages/crypto` provides team-key helpers: `generateTeamKey`, `wrapTeamKey`, `unwrapTeamKey`, and `makeTeamKeyAd`.
- Team keys are 32-byte symmetric keys. Wrapping uses a random 32-byte wrapping key, XChaCha20-Poly1305 with AD `trominal:v1:team_key:<team_id>:member:<member_id>:v<key_version>`, and libsodium sealed boxes to encrypt the wrapping key for the member's X25519 public key.
- The server-storable shape stays `{ ciphertext, nonce }`; `ciphertext` contains a versioned payload with the sealed wrapping key plus encrypted team key, while `nonce` is the XChaCha20 nonce.
- Tests cover round-trip unwrap, wrong-member failure, AD/key-version mismatch failure, fresh nonce/material generation, and team-key length.

#### Phase 8C implementation notes

- Vault resources now support real team scope through nullable `team_id` columns on groups, hosts, snippets, identities, tunnels, and host credentials. AI settings remain personal-only.
- `GET /api/v1/vault/{resource}` omits `team` for personal records and accepts `?team=<team_id>` for team records. Delta sync includes personal records plus records from every team where the user is a member.
- Vault policies allow access when the user owns a personal record or belongs to the record's team. Relationship IDs must stay inside the same scope, so a team host cannot point to a personal group and a personal host cannot point to a team group.
- Master-password rotation explicitly stays personal-only; team-scoped resources are encrypted with team keys and are rejected from `/api/v1/me/master-password/change`.

#### Phase 8D implementation notes

- Filament now has `TeamResource` under Administration. Admins with `admin.teams.manage` can list teams, view team metadata, inspect member rows, and delete teams with an `admin.team.deleted` audit log entry.
- Filament intentionally does not create or edit teams. A valid zero-knowledge team requires a client-generated team key plus per-member wrapped keys, which the server-side admin panel cannot produce without breaking the encryption model.
- Still pending in later Phase 8 slices: client create/share flows that use team keys.

#### Phase 8E implementation notes

- The client sidebar has a workspace switcher for Personal vault versus teams returned by `GET /api/v1/teams`.
- Team names are decrypted client-side by decrypting the user's private key with the in-memory vault key, unwrapping the member-specific team key, then decrypting `teams.name_ciphertext`. Failed team-name decrypts fall back to a non-secret team id label.
- Vault list hooks now include the selected team id in their TanStack Query cache keys, pass `?team=<team_id>` through the API client, and decrypt team-scoped records with the selected team key plus team-scoped associated data. AI settings remain personal-only.
- The selected team key is memory-only and is wiped on workspace switch, vault lock, and logout.
- Client create/edit/delete actions for vault resources are intentionally guarded while a team workspace is selected. Team writes require the next Phase 8 slice because resources must be encrypted with the team key and team-scoped associated data, not the personal vault key.

### Phase 9 — Polish, Docs, Release

- Settings → Connection (change API URL).
- Settings → Account (2FA, devices, change master password).
- Settings → Appearance (theme, font, terminal colors).
- Auto-updater (Tauri).
- Code signing docs (macOS notarization, Windows).
- Linux: AppImage + .deb + .rpm via tauri-action.
- Web build deployable behind same Caddy as backend.
- `docs/SELF_HOSTING.md`, `docs/SECURITY.md`, `docs/ARCHITECTURE.md`, `docs/ADMIN_GUIDE.md`.
- v0.1.0 tag (without Phase 8 if you want to ship sooner).

#### Phase 9 implementation notes

- Settings → Connection, Account, Appearance, and Advanced are implemented in the client.
- Advanced includes a manual desktop updater check/install flow. Web builds show deployment-channel status instead.
- The Tauri updater plugin is installed and permitted for desktop. Release builds inject updater `pubkey`, endpoint, and `createUpdaterArtifacts` via `.github/workflows/release.yml` so local dev builds do not require signing keys.
- Tagged releases (`v*.*.*`) build a web artifact plus desktop bundles. Linux release output targets AppImage, deb, and rpm.
- Release, self-hosting, current architecture, security operations, and admin docs live under `docs/`.

---

## 12. Quality Bars

- **Test coverage:** ≥80% backend, ≥70% client.
- **Type safety:** strict TS, PHPStan level 8, no `any`/`mixed` without comment.
- **Lint clean** on every commit (Husky + lint-staged).
- **Conventional Commits** for all messages.
- **Every PR** has description, linked issue, screenshots if UI, security checklist if relevant.
- **Cross-platform crypto test:** CI runs both TS and Rust crypto on the same inputs and asserts identical ciphertexts.
- **Permission tests:** every admin endpoint and every Filament resource has at least one "non-admin gets 403" test.

---

## 13. Decisions Still to Make

| Phase | Question                                                                                     |
| ----- | -------------------------------------------------------------------------------------------- |
| 5     | Default font for terminal? (recommend JetBrains Mono)                                        |
| 7     | Default AI providers in dropdown? (suggest: OpenAI, Anthropic, Ollama, Custom)               |
| 8     | Team encryption: X25519 sealed boxes vs ECDH-derived KEK? (recommend sealed boxes — simpler) |
| 9     | Telemetry: opt-in anonymous usage stats? (default: NO)                                       |
| 9     | Hosted version — billing/Pro tier? (out of scope for v0.1)                                   |

---

## 14. Working Agreement

- **Start with Phase 0.** Do not skip ahead.
- After each phase: run all tests, commit with conventional message, push, summarize what changed, **ask before starting the next phase**.
- If anything in this brief seems wrong, contradictory, or under-specified — **stop and ask**, don't guess.
- For any new dependency: justify it in the commit message.
- For any crypto change: write the test first, then the code.
- For every endpoint: write the OpenAPI definition first, then the controller, then the test.
- For every admin Filament page: write the authorization test first, then the page.
- Branch per phase: `phase/0-foundation`, `phase/1-auth`, etc.
