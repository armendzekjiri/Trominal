# GitHub Copilot Instructions for Trominal

> Auto-loaded by GitHub Copilot in supported editors.

## What is Trominal?

Open-source, self-hostable, cross-platform Termius alternative. Two surfaces:

1. **Client app** (Tauri + React) — SSH workflow for end-users.
2. **Filament admin panel** (Laravel `/admin`) — operator's control room for users, roles, teams, settings, audit log.

First registered user gets BOTH `admin` and `user` roles.

## Authoritative project files

When generating any non-trivial code, treat these as source of truth:

- `.ai/shared/PROJECT_BRIEF.md` — full spec, locked decisions, phased plan
- `.ai/shared/CODING_RULES.md` — universal coding rules
- `.ai/shared/ARCHITECTURE.md` — system architecture
- `.ai/design/` — **visual source of truth**: tokens.css + JSX mockups for every screen
- `.ai/skills/` — focused skill files per topic

## Locked tech stack — do not suggest alternatives

- Backend: **Laravel 13** + **Filament 3** + PostgreSQL 16 + Redis 7 + Sanctum + Reverb + Horizon
- Permissions: **Spatie Laravel Permission**
- Frontend: **Tauri 2 + React 18 + TypeScript + Vite + Tailwind + shadcn/ui**
- SSH (desktop): **russh** (Rust)
- SSH (web): **phpseclib** server-side proxy via WebSocket
- Crypto: **libsodium** (`libsodium-wrappers-sumo` in TS, `dryoc` in Rust)
- Terminal: **xterm.js**
- State: **Zustand** + **TanStack Query**
- Tests: **Pest** (PHP), **Vitest + Playwright** (TS), **cargo test** (Rust)
- License: **AGPL-3.0**

## Universal coding rules

### Security

- **Never log** SSH keys, passwords, tokens, AI keys, decrypted secrets.
- **Never commit `.env`** or files with real credentials.
- **Crypto:** XChaCha20-Poly1305 for symmetric (never AES-GCM with random nonce). Argon2id for password→key. Always pass associated data: `"trominal:v1:<resource_type>:<id>"`.
- **Vault key in memory only.** Never localStorage/IndexedDB/Tauri storage.
- **Zeroize secrets** on disconnect — `zeroize` in Rust, `.fill(0)` in TS.
- **Master password** never travels to the server. Login password is separate.
- **Audit log entry** for every admin action and every sensitive user action.

### Roles & permissions

- Default roles seeded: `admin`, `user`, `guest`.
- First user gets `admin` + `user`.
- API endpoints gated by `can:permission.name` middleware.
- Filament resources gated by `canViewAny()` + panel-level `EnsureUserHasRole:admin`.
- `/api/v1/me` returns roles + permissions for client UI gating.

### Backend (Laravel 13)

- API + Filament — separate route files, separate middleware groups.
- Form Requests for validation. Policies for authorization. Services for business logic.
- Controllers stay thin. Always typed return.
- ULID primary keys. Soft deletes. `encrypted` cast on `*_ciphertext` columns.
- Larastan level 8.
- OpenAPI spec is source of truth for API.

### Filament admin panel

- **Every Resource and Page** must override `canViewAny()` / `canAccess()` with role/permission check.
- **Every state-changing action** writes audit log.
- **Never display** `password`, `two_fa_secret_enc`, `private_key_*`, refresh tokens, vault ciphertexts in any column or field.
- **Self-foot-gun prevention**: cannot delete self, cannot demote last admin.

### Client (TypeScript)

- Strict TS. No `any` without comment.
- TanStack Query for server state. Zustand for app state.
- shadcn/ui components first.
- Tailwind only — use **mapped tokens** (`bg-bg-elev`, `text-fg-muted`), not raw Tailwind colors.
- react-hook-form + zod for forms.
- Permission-aware UI: hide buttons based on `me.permissions`.
- **Match the design.** Every UI implementation must mirror the reference in `.ai/design/`. The folder contains JSX mockups for every screen plus design tokens.

### Rust (src-tauri)

- Clippy clean.
- No `unwrap()` in production paths.
- `Zeroizing<>` wrapper for any secret bytes.

### Commits & PRs

- Conventional Commits: `feat:`, `fix:`, `security:`, `breaking:`, `docs:`, `design:`, `refactor:`, `test:`, `chore:`.
- Branch per phase: `phase/0-foundation`, `phase/1-auth`, etc.
- PRs include description, linked issue, screenshots if UI, security checklist if relevant.

## Style preferences

- **PHP:** PSR-12, `declare(strict_types=1);`, `final` classes by default.
- **TypeScript:** functional components, named exports preferred, `const` over `let`.
- **Rust:** prefer `?` for error propagation, `&str` over `String` params, `#[must_use]` on important returns.

## What NOT to suggest

- ❌ AES-GCM with random nonces, SHA1, MD5, custom crypto
- ❌ `Math.random()` for security purposes
- ❌ `localStorage`/`sessionStorage` for sensitive data
- ❌ Express, Next, Nest, or any non-Laravel backend
- ❌ MySQL, MongoDB, SQLite (Postgres only)
- ❌ Electron (we use Tauri)
- ❌ Redux, MobX, Recoil, Jotai (Zustand only)
- ❌ Material UI, Chakra, Ant Design (shadcn/ui only)
- ❌ Raw Tailwind colors (`text-zinc-*`, `bg-neutral-*`) — use mapped design tokens
- ❌ Closed-source dependencies — must be AGPL-3.0 compatible
- ❌ Filament resources without role gating
- ❌ Admin actions without audit log entries
- ❌ UI that diverges from `.ai/design/` reference

## When uncertain

Stop and surface the question rather than guessing. The brief is in `.ai/shared/`, the design in `.ai/design/`.
