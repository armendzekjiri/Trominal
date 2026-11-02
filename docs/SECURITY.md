# Security Operations

This file is the operator checklist. The threat model lives in the root [`SECURITY.md`](../SECURITY.md).

## Secrets

Never commit:

- `.env`
- SSH private keys
- Tauri signing keys
- API tokens
- database dumps
- real certificates

Use GitHub Actions secrets for release signing and updater keys.

## Required Production Controls

- Serve only over HTTPS.
- Set `APP_DEBUG=false`.
- Restrict `ALLOWED_ORIGINS` to the deployed web origin and `tauri://localhost`.
- Keep PostgreSQL and Redis private.
- Use Redis-backed sessions/cache/queues for production.
- Run queue workers under a supervisor.
- Back up PostgreSQL regularly and test restores.
- Monitor audit logs for unknown logins and connection attempts.

## Vault Guarantees

The server stores ciphertext. The client owns decryption.

- Master password never leaves the client.
- Vault key lives in memory only.
- Vault records use XChaCha20-Poly1305.
- Associated data binds ciphertext to the resource id.
- Master password rotation re-encrypts records client-side before upload.

## Desktop Versus Web

Desktop is the preferred high-security path for v0.1 because SSH, SFTP, and tunnels execute locally through Tauri.

Web SSH is proxied through the backend and is disabled by default. When an admin enables it, the backend sees SSH passwords and private keys in plaintext for the length of each session, because browsers cannot open raw SSH TCP sockets. Only enable it if you trust the backend operator and host. The proxy requires a pinned host key fingerprint before sending credentials, binds each single-use token to a destination and client IP, and refuses non-public destinations unless `TROMINAL_WEB_SSH_ALLOWED_CIDRS` lists them. See [Web SSH in the self-hosting guide](SELF_HOSTING.md#web-ssh-disabled-by-default). Web SFTP and tunnel proxying are still planned.

## Release Signing

Tauri updater artifacts are signed with a private updater key in CI. The public key is embedded in release builds through the Tauri config supplied by `.github/workflows/client-release.yml`.

macOS builds are signed with a Developer ID Application certificate and notarized with an App Store Connect API key.

All signing secrets are environment secrets of the GitHub `release` environment, never repository secrets. The environment accepts only jobs running on `main`, and a required reviewer has to approve each run. Workflows edited on other branches, in pull requests or in forks therefore can't read them. The full list and setup are in [RELEASE.md](RELEASE.md#how-the-signing-secrets-are-protected).

If the updater private key is lost, installed desktop clients cannot verify future updates signed by a replacement key.

## Incident Response

1. Rotate backend `.env` secrets and database credentials.
2. Revoke refresh tokens for affected users.
3. Review `audit_log`.
4. Ship a signed desktop update if client code was affected.
5. Publish a security advisory after a fix is available.
