# Trominal — Coding Rules

> Universal rules for all AI coding agents working on this project. Read alongside `.ai/shared/PROJECT_BRIEF.md`.

## General

- **Never guess** when the brief is ambiguous. Stop and ask the user.
- **Never skip phases.** Phase N requires Phase N-1 complete and merged.
- **Conventional Commits** mandatory: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `security:`, `breaking:`.
- **Every PR** has: description, linked issue, screenshots if UI, security checklist if auth/crypto/network.
- **Branch per phase:** `phase/0-foundation`, `phase/1-auth`, etc.
- **No new dependency** without justification in the commit message.

## Security

- **Never log secrets.** No SSH keys, passwords, tokens, AI keys in any log line. Ever.
- **Never commit `.env`** or any file with real credentials.
- **Crypto test-first.** Write the test, watch it fail, then implement.
- **Cross-platform crypto parity.** TS (`libsodium-wrappers-sumo`) and Rust (`dryoc`) must produce byte-identical ciphertexts. CI enforces this.
- **AEAD associated data** binds ciphertexts to their resource: `"trominal:v1:" + resource_type + ":" + resource_id`.
- **Master password** must NEVER hit the network. Login password is separate and goes to the server (hashed).
- **Audit log** receives every vault access, every connection attempt. Never receives plaintext content.
- **Zeroize** secrets on disconnect — Rust uses `zeroize` crate; JS overwrites buffers and drops references.

## Backend (Laravel 13)

- **API-only.** No Blade. No web routes for users.
- **PHPStan/Larastan level 8.** No suppressions without a comment explaining why.
- **No `mixed`** without comment.
- **Form Requests** for every POST/PUT — no validation in controllers.
- **Policies** enforce ownership on every authenticated resource.
- **Service classes** for business logic; controllers stay thin.
- **Eloquent encrypted casts** on every `*_ciphertext` column (defense in depth).
- **Pest** tests, ≥80% coverage. Feature tests for every endpoint, unit tests for services.
- **OpenAPI spec first.** Define endpoint in `openapi.yaml` → write controller → write test.
- **Migrations are forward-only.** No editing committed migrations; create a new one.

## Client (React + TypeScript)

- **Strict TS.** No `any` without comment. Prefer `unknown` + narrowing.
- **No `useEffect` for derived state.** Use `useMemo` or compute during render.
- **TanStack Query** for server state. **Zustand** for app state. Don't mix them up.
- **shadcn/ui first.** Don't reinvent components that exist.
- **Tailwind only.** No inline `style` props except dynamic values.
- **No localStorage for secrets.** Use Tauri secure storage on desktop; encrypted IndexedDB on web.
- **Vitest** for units, **Playwright** for E2E.
- **No CSS-in-JS.** Tailwind classes only.

## Rust (src-tauri)

- **Clippy clean** on every commit (`-D warnings`).
- **No `unwrap()`** in production paths. Use `?` with proper error types (`thiserror`).
- **`zeroize`** for any byte buffer holding secret material.
- **Tauri commands** are async, return `Result<T, String>` where the error is a user-safe message.

## Documentation

- **Every public API** documented in OpenAPI.
- **Every Rust public function** has a doc comment.
- **Every TS public export** has a TSDoc comment.
- **README + CHANGELOG + docs/** stay in sync with what's actually built. Update them in the same PR as the code change.

## What NOT to do

- Don't add a feature not in the current phase without asking.
- Don't refactor unrelated code in a feature PR.
- Don't disable a failing test to make CI green. Fix the bug or fix the test, with a comment.
- Don't add telemetry, analytics, or external network calls without explicit user approval.
- Don't add a closed-source dependency. AGPL-3.0 compatibility required.
