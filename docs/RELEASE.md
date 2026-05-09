# Release Guide

Releases are tag-driven and split by deployable. Backend and client versions are intentionally independent.

## Tags

- `backend-v0.1.0` builds and publishes only the backend Docker image.
- `client-v0.1.0` builds only the web client artifact and desktop bundles.
- `backend-v0.1.1-rc.1` and `client-v0.1.1-rc.1` build release candidates. They are prereleases and do not update `latest`.
- `v0.1.0` can still be used as a human product milestone tag, but it does not trigger release builds.

Use SemVer independently per deployable. The backend and client can both start at `0.1.0`, but later they only move when that deployable changes.

## Branches

- `main` is protected and receives changes only through PRs.
- `release/backend-v0.1` stabilizes the next backend `0.1.x` release line.
- `release/client-v0.1` stabilizes the next client `0.1.x` release line.
- `hotfix/backend-v0.1.1` starts from the latest stable backend tag being patched.
- `hotfix/client-v0.1.1` starts from the latest stable client tag being patched.

Release and hotfix branches should contain only release-blocking fixes, version/config changes, and documentation for that release. New features go through normal feature or phase branches.

## Normal Release Flow

Start from updated `main` and create the release branch for the deployable:

```bash
git switch main
git pull origin main
git switch -c release/backend-v0.1
git push -u origin release/backend-v0.1
```

For a client release, use `release/client-v0.1`.

Create RC tags from the release branch:

```bash
git tag backend-v0.1.0-rc.1
git push origin backend-v0.1.0-rc.1
```

If another fix is needed, commit it to the same release branch and create the next RC:

```bash
git tag backend-v0.1.0-rc.2
git push origin backend-v0.1.0-rc.2
```

After the accepted RC passes smoke testing, merge the release branch into `main` through a PR. Then tag the stable release from updated `main`:

```bash
git switch main
git pull origin main
git tag backend-v0.1.0
git push origin backend-v0.1.0
```

Use the equivalent `client-v0.1.0-rc.N` and `client-v0.1.0` tags for client releases.

## Hotfix Flow

Use a hotfix when production needs a patch before the next normal release. Start from the latest stable tag of the deployable being fixed, not from the current release candidate and not from an unrelated product tag.

Backend hotfix from the last backend release:

```bash
git fetch origin --tags
git switch -c hotfix/backend-v0.1.1 backend-v0.1.0
```

Client hotfix from the last client release:

```bash
git fetch origin --tags
git switch -c hotfix/client-v0.1.1 client-v0.1.0
```

Apply the smallest safe fix, run the relevant tests, and push the branch:

```bash
git push -u origin hotfix/backend-v0.1.1
```

Create a hotfix RC first unless the fix is a documentation-only correction:

```bash
git tag backend-v0.1.1-rc.1
git push origin backend-v0.1.1-rc.1
```

After smoke testing, tag the stable hotfix from the exact tested hotfix branch commit:

```bash
git tag backend-v0.1.1
git push origin backend-v0.1.1
```

Open a PR from the hotfix branch back into `main` immediately after the stable tag is pushed. If there is an active release branch for the same deployable, also open a second PR into that release branch so the fix is not lost.

Never force-move a stable release tag after it has been pushed. If a published release is wrong, create the next patch version.

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
