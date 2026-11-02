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

Web SSH/SFTP/tunnel proxying is planned. When enabled, web transport requires trusting the backend process during active sessions because browsers cannot open raw SSH TCP sockets.

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
