# Contributing To Trominal

Trominal is built phase by phase. Start with the project brief and keep changes scoped to the current phase.

## Before Coding

- Read `.ai/shared/PROJECT_BRIEF.md`.
- Read `.ai/shared/CODING_RULES.md`.
- Load any relevant `.ai/skills/*.md` file for the area you are touching.
- Do not skip phases or add out-of-phase features without approval.

## Local Development

```bash
docker compose -f docker/docker-compose.dev.yml up -d
pnpm install
composer --working-dir apps/backend install
```

The development PostgreSQL container is exposed on host port `55432` to avoid conflicts with local Postgres installs. Redis uses `6379`.

Backend:

```bash
cd apps/backend
php artisan migrate
php artisan serve
```

Client:

```bash
cd apps/client
pnpm tauri dev
```

## Quality Checks

```bash
pnpm lint
pnpm test
pnpm typecheck
pnpm analyse:backend
```

## Commits

Use Conventional Commits:

- `feat:`
- `fix:`
- `security:`
- `breaking:`
- `docs:`
- `design:`
- `refactor:`
- `test:`
- `chore:`

Every PR should include a summary, phase, linked issue if any, screenshots for UI, security notes for auth/crypto/network/storage, and a test plan.
