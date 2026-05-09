# Release Guide

Releases are tag-driven and split by deployable. Backend and client versions are intentionally independent.

## Tags

- `backend-v0.1.0` builds and publishes only the backend Docker image.
- `client-v0.1.0` builds only the web client artifact and desktop bundles.
- `v0.1.0` can still be used as a human product milestone tag, but it does not trigger release builds.

## Backend Release

Pushing a backend tag runs `.github/workflows/backend-release.yml`:

```bash
git tag backend-v0.1.0
git push origin backend-v0.1.0
```

The workflow runs backend tests, builds `apps/backend/Dockerfile`, and publishes:

```text
ghcr.io/armendzekjiri/trominal-backend:0.1.0
ghcr.io/armendzekjiri/trominal-backend:0.1
ghcr.io/armendzekjiri/trominal-backend:latest
```

Prerelease tags such as `backend-v0.2.0-beta.1` do not update `latest`.

Self-hosted update flow:

```bash
TROMINAL_BACKEND_IMAGE=ghcr.io/armendzekjiri/trominal-backend:0.1.0 docker compose pull app queue scheduler ssh-proxy
TROMINAL_BACKEND_IMAGE=ghcr.io/armendzekjiri/trominal-backend:0.1.0 docker compose up -d app queue scheduler ssh-proxy
docker compose exec app php artisan migrate --force
```

The backend image receives `TROMINAL_BACKEND_VERSION` from the tag. `/api/server-info` exposes `backend_version`, `api_version`, and `min_client_version` so clients can make compatibility decisions.

## Client Release

Pushing a client tag runs `.github/workflows/client-release.yml`:

```bash
git tag client-v0.1.0
git push origin client-v0.1.0
```

The workflow builds:

- Web client artifact: `trominal-web-dist-0.1.0`
- macOS desktop bundles for Apple Silicon and Intel
- Windows desktop bundles
- Linux AppImage, deb, and rpm bundles
- Tauri updater signatures
- `latest.json` for the updater endpoint

The client release is created as a draft so it can be checked before publishing.

## Updater Keys

Generate the updater signing key once:

```bash
pnpm --dir apps/client tauri signer generate -- -w ~/.tauri/trominal.key
```

Store:

- private key content in `TAURI_SIGNING_PRIVATE_KEY`
- private key password in `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- public key content in `TAURI_UPDATER_PUBKEY`

Do not rotate the updater key casually. Existing installed clients trust the public key embedded in the build they installed.

## GitHub Secrets

Required for signed updater artifacts:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- `TAURI_UPDATER_PUBKEY`

Recommended for macOS Developer ID signing and notarization:

- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`

Windows signing depends on the chosen certificate provider. For Microsoft Trusted Signing, configure the Azure credentials and a Tauri `bundle.windows.signCommand` in a follow-up signing PR.

## Create A Release

From a clean `main`, choose the deployable being released:

```bash
git tag backend-v0.1.0
git push origin backend-v0.1.0

git tag client-v0.1.0
git push origin client-v0.1.0
```

For client releases:

1. Wait for all release jobs to finish.
2. Download and smoke-test macOS, Windows, and Linux installers.
3. Confirm `latest.json` exists on the draft release.
4. Confirm `.sig` files are attached.
5. Publish the draft release.

## Web Deployment

Deploy the matching web artifact, for example `trominal-web-dist-0.1.0`, behind the same origin as the backend reverse proxy. The web app is a Vite SPA; route unknown non-API paths to `index.html`.

## Desktop Updater

Release builds inject updater config with:

```json
{
  "bundle": {
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "pubkey": "TAURI_UPDATER_PUBKEY",
      "endpoints": [
        "https://github.com/armendzekjiri/Trominal/releases/latest/download/latest.json"
      ],
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

The desktop client exposes manual update checks in Settings -> Advanced.

## References

- Tauri updater: https://v2.tauri.app/plugin/updater/
- Tauri action: https://github.com/tauri-apps/tauri-action
- Tauri macOS signing: https://v2.tauri.app/distribute/sign/macos/
- Tauri Windows signing: https://v2.tauri.app/distribute/sign/windows/
