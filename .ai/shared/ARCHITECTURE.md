# Trominal — Architecture Overview

> High-level architecture reference for AI agents and contributors.

## System diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌──────────────────┐
│  Desktop client │    │   Web client    │    │  Mobile client  │    │  Admin's browser │
│  (Tauri+React)  │    │     (React)     │    │   (Tauri 2)     │    │     (any)        │
│                 │    │                 │    │    [future]     │    │                  │
│  ┌───────────┐  │    │                 │    │                 │    │  Filament panel  │
│  │ PTY ssh   │  │    │                 │    │                 │    │   /admin (Blade) │
│  │ v0.1      │──┼────┼─────────────────┼────┼─────► target    │    │                  │
│  └───────────┘  │    │                 │    │      hosts      │    │                  │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘    └────────┬─────────┘
         │ HTTPS+WSS            │ HTTPS+WSS            │ HTTPS+WSS            │ HTTPS
         │ /api/v1, /ws         │ /api/v1, /ws         │ /api/v1, /ws         │ /admin
         │                      │                      │                      │
         └──────────┬───────────┴──────────────────────┴──────────────────────┘
                    │
            ┌───────▼────────────────────────┐
            │  Caddy (auto-TLS reverse proxy)│
            └───────┬────────────────────────┘
                    │
       ┌────────────┼────────────┬───────────────┐
       │            │            │               │
   ┌───▼────────┐  ┌▼─────────┐  ┌▼─────────┐    ┌───▼──────┐
   │   app      │  │  reverb  │  │   queue  │    │  static  │
   │  Laravel   │  │  (WS srv)│  │ (Horizon)│    │  web ui  │
   │  ┌───────┐ │  └────┬─────┘  └────┬─────┘    └──────────┘
   │  │  API  │ │       │             │
   │  └───────┘ │       │             │
   │  ┌───────┐ │       │             │
   │  │Filamnt│ │       │             │
   │  └───────┘ │       │             │
   └────┬───────┘       │             │
        │   ┌───────────┼─────────────┘
        │   │           │
    ┌───▼───▼────┐   ┌──▼─────┐
    │ Postgres   │   │ Redis  │
    │     16     │   │   7    │
    └────────────┘   └────────┘
```

The single `app` container serves both the API (`/api/v1/*`, `/api/server-info`, etc.) and the Filament admin panel (`/admin/*`). Same Laravel codebase, different routes/middleware.

## The two surfaces

```
┌─────────────────────────────────────────┐  ┌────────────────────────────────────┐
│  CLIENT APP (Tauri + React)             │  │  ADMIN PANEL (Filament/Blade)      │
│                                         │  │                                    │
│  Used by: end-users (developers)        │  │  Used by: instance operators       │
│  URL:     bundled app or static web     │  │  URL:     /admin                   │
│  Auth:    Sanctum tokens                │  │  Auth:    Laravel session + 2FA    │
│  Role:    `user` (or `admin`+`user`)    │  │  Role:    `admin` only             │
│                                         │  │                                    │
│  Manages:                               │  │  Manages:                          │
│  • Personal hosts, snippets             │  │  • Users (create/suspend/delete)   │
│  • SSH terminals & tunnels              │  │  • Roles & permissions             │
│  • SFTP transfers                       │  │  • Teams (Phase 8)                 │
│  • AI integration (BYOK)                │  │  • Invite codes                    │
│  • Personal account & 2FA               │  │  • Registration mode toggle        │
│                                         │  │  • Instance settings               │
│  Cannot:                                │  │  • Audit log (read-only)           │
│  • See other users' data                │  │  • System health                   │
│  • Manage instance settings             │  │                                    │
│  • Change roles or permissions          │  │  Cannot:                           │
│                                         │  │  • Decrypt user vaults             │
│                                         │  │  • Start SSH sessions              │
│                                         │  │  • View terminal content           │
└─────────────────────────────────────────┘  └────────────────────────────────────┘
```

## Data flow: signup + master password setup

```
Client                                Server
  │                                     │
  │── GET /api/server-info ────────────▶│
  │◀────────── { registration_open } ───│
  │                                     │
  │ User enters email + login password  │
  │ User enters master password         │
  │                                     │
  │ generate kdf_salt (16 bytes random) │
  │ vault_key = Argon2id(master, salt)  │
  │ generate user keypair (x25519)      │
  │ private_key_ct = encrypt(sk,        │
  │                  vault_key, ad)     │
  │                                     │
  │── POST /auth/register ──────────────▶
  │   { email, login_password,          │
  │     kdf_salt, kdf_params,           │
  │     public_key,                     │
  │     private_key_ciphertext,         │
  │     private_key_nonce }             │
  │                                     │ ATOMIC TX:
  │                                     │  - LOCK FOR UPDATE settings
  │                                     │  - check registration_open
  │                                     │  - User::count() === 0?
  │                                     │  - create user
  │                                     │  - assign 'admin'+'user' if first
  │                                     │    else 'user'
  │                                     │  - if single mode + first:
  │                                     │      registration_open = false
  │                                     │  - audit log entry
  │                                     │
  │◀── { user, roles, permissions,    ──│
  │      access_token, refresh_token } │
  │                                     │
  │ Now: user can access client app     │
  │      AND /admin (if admin role)     │
```

## Data flow: desktop SSH connect

```
User clicks "Connect to host X"
  │
  ▼
React: check `me.permissions` includes `hosts.connect`
  │
  ▼
React: fetch host + credentials (encrypted)
  │
  ▼
React: decrypt credentials with vault_key (libsodium)
  │
  ▼
React: invoke Tauri command `ssh_connect`
  with host info + decrypted private key
  │
  ▼
Rust: zeroize JS-side buffer reference (drop)
  │
  ▼
Rust: spawn system `ssh` in a PTY → authenticate → open remote shell
  │
  ▼
Bidirectional pipe:
  xterm.js  ◀──Tauri events──▶  Rust  ◀──TCP──▶  remote sshd
  │
  ▼
On disconnect: PTY child exits, temporary key files are removed, key bytes are zeroized
```

## Data flow: web SSH connect

```
User clicks "Connect to host X" in web client
  │
  ▼
React: check permissions, decrypt credentials with vault_key
  │
  ▼
React: POST /api/v1/ws/ssh-token
  → returns short-lived (30s) single-use token
  │
  ▼
React: WSS /ws/ssh?token=...
  → first frame: { host, port, username, key (decrypted) }
  │
  ▼
Reverb: validate token (single-use, IP-bound, expires)
  │
  ▼
Reverb spawns ephemeral worker process
  │
  ▼
Worker: phpseclib SSH2.connect → login → open PTY
  │
  ▼
Bidirectional pipe:
  xterm.js  ◀──WSS──▶  Worker  ◀──SSH/TCP──▶  remote sshd
  │
  ▼
On disconnect: worker exits, OS reclaims memory, audit log entry written
```

## Data flow: admin suspends a user (Filament)

```
Admin opens /admin/users
  │
  ▼
Laravel session auth → check role=admin → 2FA verified
  │
  ▼
Filament UserResource::canViewAny() → true
  │
  ▼
Admin clicks "Suspend" on a user row
  │
  ▼
Filament Action::action() runs inside DB::transaction:
  - users.suspended_at = now()
  - delete user's sanctum tokens (revoke sessions)
  - delete user's refresh tokens
  - AuditLog::record(actor=admin, action='admin.user.suspended',
                     resource_type='user', resource_id=$user->id)
  │
  ▼
Suspended user's next API call → 401 (token revoked)
Suspended user cannot log in (suspended_at check in login)
```

## Data flow: cross-device sync

```
Device A makes a change (creates a host)
  │
  ▼
Encrypt sensitive fields with vault_key (or team_key for team resources)
  │
  ▼
POST /api/v1/hosts → server stores ciphertext (with team_id if shared)
  │
  ▼
Server broadcasts {type: "host.created", id} on /ws/sync
  │
  ▼
Device B receives event
  │
  ▼
Device B: GET /api/v1/sync?since=<last_cursor>
  │
  ▼
Server returns delta (created/updated/deleted records)
  │
  ▼
Device B decrypts with its vault_key (personal) or team_key (team)
  │
  ▼
UI updates
```

## Crypto module shape

```
packages/crypto/
├── src/
│   ├── kdf.ts            # deriveVaultKey(password, salt, params)
│   ├── encrypt.ts        # encrypt(plaintext, key, ad) → {ciphertext, nonce}
│   ├── decrypt.ts        # decrypt({ciphertext, nonce}, key, ad) → plaintext
│   ├── keys.ts           # generateEd25519KeyPair, generateX25519KeyPair, generateRSAKeyPair
│   ├── team-key.ts       # wrapTeamKey, unwrapTeamKey (Phase 8)
│   ├── random.ts         # secureRandom(n)
│   ├── types.ts
│   └── index.ts
└── tests/
    ├── kdf.test.ts
    ├── encrypt.test.ts
    └── cross-platform.test.ts   # asserts identical output to Rust impl
```

## SSH transport abstraction

```
packages/ssh-transport/
├── src/
│   ├── types.ts                  # SshSession interface
│   ├── native-transport.ts       # uses Tauri commands (desktop only)
│   ├── websocket-transport.ts    # uses /ws/ssh (web + desktop fallback)
│   ├── factory.ts                # picks transport based on env
│   └── index.ts
└── tests/

interface SshSession {
  connect(): Promise<void>
  write(data: Uint8Array): void
  resize(cols: number, rows: number): void
  close(): Promise<void>
  onData(cb: (data: Uint8Array) => void): Unsubscribe
  onClose(cb: (reason: string) => void): Unsubscribe
}
```

## Permission flow

```
Login → /api/v1/me returns:
{
  id, email, two_fa_enabled, vault_version,
  roles: ["user"],                     # or ["admin", "user"]
  permissions: [
    "hosts.create", "hosts.read", ...,
    "ai.use", "audit.read.own",
    # if admin:
    "admin.users.manage", ...
  ]
}

Client uses permissions[] to:
  - Hide menu items the user can't access
  - Disable buttons for unauthorized actions
  - Avoid making requests that would 403 anyway

Server uses permissions for:
  - `can:` middleware on every API route
  - Policies on every model
  - Filament Resource canViewAny() etc.
```
