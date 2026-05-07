# AGENTS.md

> Entry point for Codex when working on Trominal. Read this top to bottom at session start.

## What Is Trominal?

Trominal is an open-source, self-hostable, cross-platform Termius alternative. It has two user-facing surfaces:

1. **Client app** - Tauri + React SSH workflow for end users on web, macOS, Windows, Linux, and later mobile.
2. **Filament admin panel** - Laravel backend panel at `/admin` for users, roles, permissions, teams, instance settings, invites, and audit logs.

The first registered user gets both `admin` and `user` roles. They use the client for SSH work and the admin panel for instance management. Later users usually receive only `user` unless promoted.

## Source Of Truth

Read these files before non-trivial work, in this order:

1. [`.ai/shared/PROJECT_BRIEF.md`](.ai/shared/PROJECT_BRIEF.md) - authoritative spec, locked decisions, phased plan.
2. [`.ai/shared/CODING_RULES.md`](.ai/shared/CODING_RULES.md) - universal coding rules.
3. [`.ai/shared/ARCHITECTURE.md`](.ai/shared/ARCHITECTURE.md) - system diagrams and data flows.
4. [`.ai/design/README.md`](.ai/design/README.md) - entry point for UI reference files.

If another instruction contradicts the project brief, the project brief wins. If the brief is ambiguous, stop and ask before guessing.

## Load Area-Specific Instructions

Before editing in one of these areas, read the matching file:

| Working on                                | Read                                                                                                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/backend/` API, models, services     | [`.ai/skills/laravel-backend.md`](.ai/skills/laravel-backend.md)                                                                              |
| `apps/backend/app/Filament/` admin panel  | [`.ai/skills/filament-admin.md`](.ai/skills/filament-admin.md)                                                                                |
| Visual UI in `apps/client/`               | [`.ai/skills/design-reference.md`](.ai/skills/design-reference.md) and [`.ai/skills/tauri-react-client.md`](.ai/skills/tauri-react-client.md) |
| Non-visual client work                    | [`.ai/skills/tauri-react-client.md`](.ai/skills/tauri-react-client.md)                                                                        |
| Crypto, vault, secrets, auth key handling | [`.ai/skills/crypto.md`](.ai/skills/crypto.md)                                                                                                |
| Tests or CI                               | [`.ai/skills/testing.md`](.ai/skills/testing.md)                                                                                              |
| Branches, commits, PRs                    | [`.ai/skills/git-workflow.md`](.ai/skills/git-workflow.md)                                                                                    |

## Locked Decisions

- Product name: **Trominal**
- Backend: **Laravel 13**
- Admin panel: **Filament 3**
- Permissions: **Spatie Laravel Permission**
- Database: **PostgreSQL 16**
- Cache, sessions, queues: **Redis 7**
- API auth: **Laravel Sanctum**
- WebSockets: **Laravel Reverb**
- Frontend: **Tauri 2 + React 18 + TypeScript + Vite**
- UI: **Tailwind + shadcn/ui**
- Desktop SSH: **russh**
- Web SSH: **phpseclib** server-side WebSocket proxy
- Crypto: **libsodium** in TypeScript, **dryoc** in Rust
- Terminal: **xterm.js**
- State: **Zustand** for app state, **TanStack Query** for server state
- Tests: **Pest**, **Vitest**, **Playwright**, **cargo test**
- License: **AGPL-3.0**
- Teams: first-class, but Phase 8 after v0.1.0

Do not suggest alternate stacks without explicit user approval.

## Working Agreement

- Start with Phase 0 from `.ai/shared/PROJECT_BRIEF.md` section 11. Do not skip phases.
- Before starting a phase, summarize the intended work, locked stack, security principles, role model, design source of truth, phase number, and any contradictions found.
- After each phase: run the relevant tests, commit on the phase branch with a Conventional Commit, push, open a PR, summarize results, and ask before starting the next phase.
- Do not add features outside the current phase without asking.
- Do not add dependencies without a concrete justification in the commit message.
- Do not refactor unrelated code in feature work.
- When a repository is not initialized with git yet, do the file work normally and report that branch/commit/PR steps could not be performed.

## Security Rules

- Never log SSH keys, passwords, tokens, AI keys, decrypted vault contents, or other secrets.
- Never commit `.env` or real credentials.
- Master password never travels to the server. Login password is separate.
- Vault key lives in memory only. Never store it in localStorage, sessionStorage, IndexedDB, or Tauri storage.
- Use XChaCha20-Poly1305 for symmetric encryption and Argon2id for password-to-key derivation.
- Always use AEAD associated data in the form `trominal:v1:<resource_type>:<id>`.
- Wipe secrets on lock or disconnect: `.fill(0)` in TypeScript, `Zeroizing<>` in Rust.
- Every admin action and every sensitive user action must write an audit log entry without plaintext content.
- Crypto changes are test-first: write the failing test before implementation.

## Backend Rules

- API and Filament share one Laravel app but use separate routes, middleware, and auth flows.
- Controllers stay thin. Use Form Requests for validation, Policies for authorization, and Services for business logic.
- OpenAPI is the source of truth for API endpoints: spec first, then controller, then tests.
- Use ULID primary keys, soft deletes, and encrypted casts on every `*_ciphertext` column.
- First-user registration must be atomic and grant `admin` plus `user`.
- Default roles are `admin`, `user`, and `guest`.
- `/api/v1/me` returns roles and permissions for client UI gating.
- Larastan level 8. No unexplained `mixed`.

## Filament Rules

- `/admin` is the operator control panel, not an end-user feature.
- Every Resource and Page must gate access with role or permission checks.
- Every state-changing action writes an audit log entry.
- Never display sensitive columns such as `password`, `two_fa_secret_enc`, `private_key_*`, refresh tokens, API tokens, or vault ciphertexts.
- Prevent self-lockout: admins cannot delete themselves, demote the last admin, or remove the last admin role.
- Every Filament resource needs an authorization test before merge.

## Client Rules

- Strict TypeScript. No `any` without a comment explaining why.
- Use TanStack Query for server state and Zustand for app state.
- Use react-hook-form plus zod for forms.
- Use shadcn/ui components first.
- Use Tailwind mapped design tokens, not raw color utilities.
- Hide unavailable UI actions based on `/api/v1/me` permissions.
- Match `.ai/design/` reference files for UI. Update the reference first if implementation intentionally diverges.
- Keep React platform-agnostic. Branch desktop versus web behavior in the library layer.

## Rust Rules

- Clippy clean with warnings denied.
- No `unwrap()` in production paths.
- Use `?` with typed errors where possible.
- Wrap secret bytes in `Zeroizing<>`.
- Tauri commands should be async and return user-safe errors.

## What Not To Suggest

- AES-GCM with random nonces, SHA1, MD5, custom crypto, or `Math.random()` for security.
- localStorage or sessionStorage for sensitive data.
- Express, Next, Nest, Electron, MySQL, MongoDB, SQLite, Redux, MobX, Recoil, Jotai, Material UI, Chakra, or Ant Design.
- Closed-source or AGPL-incompatible dependencies.
- Filament resources without access gating.
- Admin actions without audit logs.
- UI that diverges from `.ai/design/`.

## Clarifications

When blocked, ask with:

```text
Clarification needed before proceeding:

Context: [what you are trying to do]
Conflict / ambiguity: [what is unclear]
Options I see:
  A) [option] - implication: [...]
  B) [option] - implication: [...]
Recommendation: [your pick + why]

Pausing until you confirm.
```
