# Release Guide

Releases are split by deployable. Backend and client versions are intentionally independent. Backend releases are tag-driven; client releases are built from `main` (see [Client Release](#client-release)).

## Tags

- `backend-v0.1.0` builds and publishes only the backend Docker image.
- `backend-v0.1.1-rc.1` builds a backend release candidate. It is a prerelease and does not update `latest`.
- `client-v0.1.0` tags are created by the Client Release workflow when it publishes. Pushing one by hand does not trigger a build.
- `v0.1.0` can still be used as a human product milestone tag, but it does not trigger release builds.

Use SemVer independently per deployable. The backend and client can both start at `0.1.0`, but later they only move when that deployable changes.

## Branches

- `main` is protected and receives changes only through PRs.
- `release/backend-v0.1` stabilizes the next backend `0.1.x` release line.
- `hotfix/backend-v0.1.1` starts from the latest stable backend tag being patched.
- Client fixes, release candidates and hotfixes all go through a PR into `main`, because client releases can only be built from `main`.

Release and hotfix branches should contain only release-blocking fixes, version/config changes, and documentation for that release. New features go through normal feature or phase branches.

## Normal Release Flow

Start from updated `main` and create the release branch for the deployable:

```bash
git switch main
git pull origin main
git switch -c release/backend-v0.1
git push -u origin release/backend-v0.1
```

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

## Hotfix Flow

This flow is for the backend. Client hotfixes are normal PRs into `main` with a version bump (see [Client Release](#client-release)).

Use a hotfix when production needs a patch before the next normal release. Start from the latest stable tag of the deployable being fixed, not from the current release candidate and not from an unrelated product tag.

Backend hotfix from the last backend release:

```bash
git fetch origin --tags
git switch -c hotfix/backend-v0.1.1 backend-v0.1.0
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

## The "Latest" release must be a client release

The desktop updater downloads `https://github.com/armendzekjiri/Trominal/releases/latest/download/latest.json`. GitHub resolves `releases/latest` to whichever release is marked **Latest**, so that must always be a client release. If a backend release takes the label, every desktop update check fails.

Publishing a draft makes it Latest by default, so always publish a backend draft with an explicit flag:

```bash
gh release edit backend-vX.Y.Z --draft=false --latest=false   # backend: never Latest
```

The Client Release workflow publishes stable client releases as Latest itself, and client prereleases without it.

In the GitHub UI, untick **Set as the latest release** when publishing a backend release.

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
# set TROMINAL_BACKEND_IMAGE=ghcr.io/armendzekjiri/trominal-backend:<new tag> in .env, then:
docker compose pull
docker compose up -d     # the migrate service runs pending migrations before app starts
```

The backend image receives `TROMINAL_BACKEND_VERSION` from the tag. `/api/server-info` exposes `backend_version`, `api_version`, and `min_client_version` so clients can make compatibility decisions.

## Client Release

`.github/workflows/client-release.yml` builds and publishes a client release from `main`. It starts when:

- a commit on `main` has a line starting with `build:` or `build(scope):`. For merge and squash commits, the PR title counts, so name the PR `build: release client 0.2.0`.
- someone starts it manually: Actions → Client Release → Run workflow, on `main`.

The version comes from `"version"` in `apps/client/src-tauri/tauri.conf.json`, and the release is tagged `client-v<version>`. If that tag already exists, the run fails, so bump the version in the same PR. A version with a pre-release suffix, such as `0.2.0-rc.1`, is published as a prerelease and never becomes Latest.

Because the repository uses Conventional Commits, `build:` also starts a release when it is used for build-system changes such as `build: bump pnpm`. That run fails on the existing tag unless the version was bumped. Use `chore:` or `ci:` for those changes instead.

The workflow builds:

- Web client artifact: `trominal-web-dist-<version>`
- One universal macOS bundle (Apple silicon and Intel), signed with Developer ID and notarized with the App Store Connect API key
- Windows desktop bundles
- Linux AppImage, deb, and rpm bundles
- Tauri updater signatures
- `latest.json` for the updater endpoint

Each run creates a draft release. A reviewer approves the signing jobs, which then build and upload into the draft. When every job has succeeded and `latest.json` has signed entries for `darwin-aarch64`, `darwin-x86_64`, `linux-x86_64` and `windows-x86_64`, the workflow publishes the release. If any job fails or the approval is rejected, the draft is deleted.

### Approving a release

The signing jobs wait on the `release` environment. Open the run under Actions, choose **Review deployments**, tick `release`, and approve. All waiting jobs start together.

### How the signing secrets are protected

All signing secrets are environment secrets of the `release` environment. None are repository secrets. GitHub enforces the environment's rules on its servers, so editing a workflow can't get around them:

- **Deployment branches: `main` only.** A job that names `environment: release` from any other branch, a pull request (`refs/pull/*`), a tag, or a fork is rejected before it starts. It never receives the secrets, even if a PR edits this workflow to run on its own trigger.
- **Required reviewers: @armendzekjiri, @bbilali.** Every run on `main` waits for one of them to approve.
- **Fork pull requests** never receive secrets, and Dependabot runs only get Dependabot secrets.
- **Main ruleset** (admin bypass only): changes to `main` go through a PR, force pushes and deletion are blocked, and `.github/` changes need a code owner's approval (`.github/CODEOWNERS`). This keeps the workflow on `main` from being changed without review.

The release jobs also run project code (`pnpm install`, `build.rs`, Vite), so reviewing PRs into `main` is part of protecting the secrets as well.

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

All of these are secrets of the `release` environment (Settings → Environments → release), never repository secrets.

Tauri updater (all desktop jobs):

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- `TAURI_UPDATER_PUBKEY`

macOS signing and notarization (macOS job only):

- `APPLE_CERTIFICATE`: base64 of a `.p12` holding only the "Developer ID Application" certificate and its private key
- `APPLE_CERTIFICATE_PASSWORD`: password of that `.p12`
- `APPLE_SIGNING_IDENTITY`: `Developer ID Application: <name> (<team id>)`
- `APPLE_API_KEY`: App Store Connect API key ID (Users and Access → Integrations → App Store Connect API)
- `APPLE_API_ISSUER`: the issuer ID shown above the keys table
- `APPLE_API_KEY_P8`: contents of the `AuthKey_<key id>.p8` file

To set one, pipe the value from a file so it never lands in your shell history:

```bash
gh secret set APPLE_API_KEY_P8 --env release < AuthKey_XXXXXXXXXX.p8
```

Windows signing depends on the chosen certificate provider. For Microsoft Trusted Signing, configure the Azure credentials and a Tauri `bundle.windows.signCommand` in a follow-up signing PR.

## Create A Release

Backend, from a clean `main`:

```bash
git tag backend-v0.1.0
git push origin backend-v0.1.0
```

Client:

1. Open a PR titled `build: release client X.Y.Z` that sets `"version": "X.Y.Z"` in `apps/client/src-tauri/tauri.conf.json`.
2. Merge it. The Client Release workflow starts on `main`.
3. Approve the `release` deployment in the run.
4. The workflow publishes `client-vX.Y.Z` once every platform is built and `latest.json` is complete. Then smoke-test the installers from the release page.

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
