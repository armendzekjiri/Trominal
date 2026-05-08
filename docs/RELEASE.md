# Release Guide

Releases are tag-driven. Pushing `v0.1.0` or another `v*.*.*` tag runs `.github/workflows/release.yml`.

## What CI Builds

- Web client artifact: `trominal-web-dist`
- macOS desktop bundles for Apple Silicon and Intel
- Windows desktop bundles
- Linux AppImage, deb, and rpm bundles
- Tauri updater signatures
- `latest.json` for the updater endpoint

The release is created as a draft so it can be checked before publishing.

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
- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`

Windows signing depends on the chosen certificate provider. For Microsoft Trusted Signing, configure the Azure credentials and a Tauri `bundle.windows.signCommand` in a follow-up signing PR.

## Create A Release

From a clean `main`:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Then:

1. Wait for all release jobs to finish.
2. Download and smoke-test macOS, Windows, and Linux installers.
3. Confirm `latest.json` exists on the draft release.
4. Confirm `.sig` files are attached.
5. Publish the draft release.

## Web Deployment

Deploy the `trominal-web-dist` artifact behind the same origin as the backend reverse proxy. The web app is a Vite SPA; route unknown non-API paths to `index.html`.

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
      "endpoints": ["https://github.com/<owner>/<repo>/releases/latest/download/latest.json"],
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
