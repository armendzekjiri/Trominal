# Trominal

> Open-source, self-hostable, cross-platform Termius alternative.

Cloud-synced SSH client with encrypted vault, snippets, port tunneling, SFTP, and BYOK AI integration. Identical UI on web, macOS, Windows, and Linux. Mobile coming via Tauri 2.

**Status:** 🚧 Pre-alpha. Building toward v0.1.0.

## What you get

Two surfaces from one Laravel app:

- **Client app** (Tauri + React) — the SSH workspace. Cross-platform desktop + web. Where you actually work.
- **Admin panel** (Filament 3) — at `/admin`. Manage users, teams, roles, permissions, instance settings, audit log.

The first registered user becomes admin and uses both. Subsequent users typically only use the client.

## Features (planned for v0.1)

- 🔐 Zero-knowledge encrypted vault (XChaCha20-Poly1305 + Argon2id)
- 🖥️ Cross-platform desktop client (macOS, Windows, Linux) via Tauri 2
- 🌐 Full-featured web client
- 🔄 Cross-device sync — same data everywhere
- 📋 Snippets library with variables
- 🚇 Port tunneling (local, remote, SOCKS)
- 📁 SFTP file browser
- 🤖 BYOK AI integration — bring your own provider, endpoint, key, and model
- 🏠 100% self-hostable — point clients at your own server
- 🛠️ Full admin panel — Filament-based, manages users/roles/permissions/teams
- 👥 Roles & permissions via Spatie Laravel Permission
- 🔑 TOTP 2FA
- 📜 Audit logging

Teams (shared workspaces with proper team-key crypto) ship in v0.2 (Phase 8).

## Architecture

- **Backend:** Laravel 13, Filament 3, PostgreSQL 16, Redis 7, Sanctum, Reverb, Horizon, Spatie Permission
- **Client:** Tauri 2 + React 18 + TypeScript + Tailwind + shadcn/ui
- **Crypto:** libsodium everywhere — same primitives in JS and Rust
- **SSH:** native via `russh` (desktop), proxied via WebSocket (web)

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the current architecture notes and [`.ai/shared/ARCHITECTURE.md`](.ai/shared/ARCHITECTURE.md) for the agent planning diagrams.

## Security

Trominal is designed around a **zero-knowledge vault**: your master password never leaves your device. The server stores only ciphertext.

Read the full threat model in [`SECURITY.md`](SECURITY.md).

## Self-hosting

```bash
git clone https://github.com/<your-org>/trominal.git
cd trominal
cp docker/env/backend.env.example .env
# Edit .env to set APP_KEY, APP_URL, TROMINAL_SITE_ADDRESS, DB password, etc.
docker compose up -d
docker compose exec app php artisan migrate --seed --force
```

Then:

1. Open the **client app** (web at `https://<your-domain>` or download desktop)
2. Enter your server URL on first launch
3. Register the first user → automatic admin
4. Visit `https://<your-domain>/admin` to manage your instance

Full guide: [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md).

Backend and client releases are independent:

- `backend-v2.1.1` publishes `ghcr.io/<owner>/trominal-backend:2.1.1`
- `client-v1.8.0` builds web and desktop client artifacts

## Development

```bash
# Backend (Laravel 13 — API + Filament)
cd apps/backend
composer install
php artisan migrate --seed
php artisan serve
# API at http://localhost:8000/api/v1
# Admin at http://localhost:8000/admin

# Client (Tauri + React)
cd apps/client
pnpm install
pnpm tauri dev          # desktop
pnpm dev                # web
```

See [`AGENTS.md`](AGENTS.md) for Codex guidance, [`CLAUDE.md`](CLAUDE.md) for Claude Code guidance, and [`.ai/`](.ai/) for full project docs.

## Release

Release notes, updater keys, desktop signing, and web artifact deployment are covered in [`docs/RELEASE.md`](docs/RELEASE.md).

## Contributing

PRs welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) first. Use [Conventional Commits](https://www.conventionalcommits.org/).

## License

[AGPL-3.0](LICENSE).
