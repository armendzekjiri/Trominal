# CLAUDE.md

> Entry point for **Claude Code** when working on Trominal. Read top to bottom on session start.

## What is Trominal?

Trominal is an open-source, self-hostable, cross-platform Termius alternative. It has two surfaces:

1. **Client app** (Tauri + React) — SSH workflow for end-users (web + macOS + Windows + Linux + later mobile).
2. **Filament admin panel** (Blade-based, on the Laravel backend at `/admin`) — operator's control room for users, roles, permissions, teams, instance settings, and audit log.

The first registered user gets BOTH `admin` and `user` roles, so they use the client for SSH AND the admin panel for instance management. Subsequent users typically have only `user`.

## Read these in order on session start

1. **[`/.ai/shared/PROJECT_BRIEF.md`](.ai/shared/PROJECT_BRIEF.md)** — full spec, locked decisions, phased plan. **Authoritative.**
2. **[`/.ai/shared/CODING_RULES.md`](.ai/shared/CODING_RULES.md)** — universal coding rules.
3. **[`/.ai/shared/ARCHITECTURE.md`](.ai/shared/ARCHITECTURE.md)** — system diagrams and data flows.
4. **Browse [`/.ai/design/`](.ai/design/)** if you'll be implementing UI — that folder is the visual source of truth for the client app. Start with its `README.md`.

## Skill files — load when relevant

Load the matching skill file before working in that area:

| Working on...                                          | Load skill                                                                                                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Anything in `apps/backend/` (API, models, services)    | [`.ai/skills/laravel-backend.md`](.ai/skills/laravel-backend.md)                                                                                |
| Anything in `apps/backend/app/Filament/` (admin panel) | [`.ai/skills/filament-admin.md`](.ai/skills/filament-admin.md)                                                                                  |
| Implementing UI in `apps/client/` (any visual work)    | [`.ai/skills/design-reference.md`](.ai/skills/design-reference.md) **+** [`.ai/skills/tauri-react-client.md`](.ai/skills/tauri-react-client.md) |
| Non-visual client work (routing, state, hooks)         | [`.ai/skills/tauri-react-client.md`](.ai/skills/tauri-react-client.md)                                                                          |
| Crypto, vault, key handling, auth secrets              | [`.ai/skills/crypto.md`](.ai/skills/crypto.md)                                                                                                  |
| Writing tests, CI config                               | [`.ai/skills/testing.md`](.ai/skills/testing.md)                                                                                                |
| Committing, branching, opening a PR                    | [`.ai/skills/git-workflow.md`](.ai/skills/git-workflow.md)                                                                                      |

## Working agreement

- **Start with Phase 0.** Do not skip ahead.
- **After each phase:** run all tests, commit on `phase/N-name` branch using Conventional Commits, push, open a PR with summary, **stop and ask** before starting the next phase.
- **Never guess on contradictions** — if the brief is ambiguous, ask the user.
- **Crypto changes:** write the failing test first, then the code. Commit history must reflect this.
- **Endpoints:** define in `openapi.yaml` first, then controller, then test.
- **UI:** match `.ai/design/` reference. If implementation diverges, update the reference first.
- **Admin panel:** every Filament resource needs an authorization test before merge.
- **No new dependency** without justification in the commit message.
- **No secrets in logs.** Ever.
- **Audit log entry** for every admin action and every sensitive user action.

## Locked decisions (do not deviate without user approval)

- Product name: **Trominal**
- Backend: **Laravel 13** (latest)
- Admin panel: **Filament 3**
- Permissions: **Spatie Laravel Permission**
- Teams: first-class but **Phase 8** (after v0.1.0)
- Database: **PostgreSQL 16**
- Frontend: **Tauri 2 + React + TypeScript + Vite**
- Web SSH: **enabled** via WebSocket proxy
- Registration: **single-user mode by default**
- License: **AGPL-3.0**
- Visual design: locked in `.ai/design/` — dark-first warm charcoal, green accent, JetBrains Mono

## First action

If `apps/backend/` and `apps/client/` are empty, start **Phase 0** as described in `.ai/shared/PROJECT_BRIEF.md` §11.

Before writing code, summarize back to the user (5-10 bullets):

- What we're building (client app + admin panel)
- The locked tech stack
- Non-negotiable security principles
- The role system and how the first user gets admin + user roles
- That `.ai/design/` is the visual source of truth
- The phase you're about to start
- Any contradictions or under-specified parts you spotted

Wait for confirmation, then proceed.

## How to ask for clarification

When stuck, ask in this format:

```
🔍 Clarification needed before proceeding:

Context: [what you're trying to do]
Conflict / ambiguity: [what's unclear]
Options I see:
  A) [option] — implication: [...]
  B) [option] — implication: [...]
Recommendation: [your pick + why]

Pausing until you confirm.
```

This lets the user respond with one letter and unblock you fast.
