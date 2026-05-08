# Architecture

Trominal has two user-facing surfaces backed by one Laravel application.

## Surfaces

- Client app: Tauri 2 + React + TypeScript. It is used for hosts, terminal sessions, snippets, identities, tunnels, SFTP, and BYOK AI.
- Admin panel: Filament on `/admin`. It is used by operators for users, roles, permissions, instance settings, invites, and audit logs.

## Backend

The backend owns authentication, authorization, encrypted vault record storage, audit logs, registration mode, and admin workflows.

Core components:

- Laravel 13 API under `/api/v1`
- Filament admin under `/admin`
- Sanctum access tokens plus refresh-token rotation
- Spatie roles and permissions
- PostgreSQL for application data
- Redis for cache, sessions, and queues
- Reverb for future web terminal proxying and realtime flows

## Client

The React client keeps platform-specific work behind library boundaries:

- `apps/client/src/lib/platform.ts` detects desktop versus web.
- `apps/client/src/lib/secure-storage.ts` uses OS keychain on desktop for refresh tokens and browser session storage on web.
- `packages/ssh-transport` abstracts terminal transport.
- `apps/client/src/stores/vault.ts` keeps the vault key in memory only.

## Vault Flow

1. User unlocks locally with the master password.
2. Client derives `vault_key` with Argon2id using server-returned KDF material.
3. Client verifies the key by decrypting the encrypted user private-key canary.
4. Client decrypts vault records locally.
5. Client encrypts changes locally with XChaCha20-Poly1305 before upload.

The server stores ciphertext, nonces, relation ids, timestamps, and tombstones. It never receives master passwords or plaintext vault contents.

## Desktop Terminal Flow

Current v0.1 desktop terminal flow:

1. User selects a host and credential.
2. Client decrypts the attached identity locally.
3. Tauri opens a local PTY and executes the system `ssh` binary.
4. Password and keyboard-interactive prompts happen inside xterm.js.
5. Tauri zeroizes transient key material after launching the transport.

`russh` remains the long-term native engine. The system `ssh` path is the v0.1 reliability choice.

## Tunnels and SFTP

Tunnels and SFTP are separate product areas.

- Tunnels run local, remote, and SOCKS forwards through the current desktop SSH path.
- SFTP uses the current host identity/auth model and Tauri commands for file transfer.
- Web proxy support for these flows remains a follow-up after v0.1 desktop reliability.

## AI Flow

AI is BYOK:

1. User configures provider, endpoint, model, API key, and feature toggles in Settings.
2. API key and settings are encrypted into the vault client-side.
3. AI calls go directly from the client to the configured provider.
4. Terminal context is included only when the user enables the feature toggle.

The Trominal backend is not an AI proxy.

## Release Flow

Tagged releases build:

- Web `dist` artifact for self-hosted deployment.
- Tauri desktop bundles for macOS, Windows, and Linux.
- Linux AppImage, deb, and rpm packages.
- Signed updater artifacts and `latest.json` when release secrets are configured.
