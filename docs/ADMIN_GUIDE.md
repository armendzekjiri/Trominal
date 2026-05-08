# Admin Guide

The admin panel lives at `/admin` on the Laravel backend. It is for instance operators, not daily SSH work.

## First Admin

Default registration mode is `single`.

1. Open the client app.
2. Enter the server URL.
3. Register the first user.
4. The backend atomically assigns `admin` and `user`.
5. Registration closes automatically.

That same account can use the client and the Filament admin panel.

## Two-Factor Requirement

Admins should enable TOTP before using the admin panel. The client exposes this under Settings -> Account. The admin panel also gates access by the `admin` role.

## Roles

Default roles:

- `admin`: operator permissions for users, roles, permissions, settings, invites, and audit logs.
- `user`: own vault resources and client workflows.
- `guest`: read-only planned team workflows.

Do not remove the last admin. The Filament resources are expected to prevent self-lockout and last-admin removal.

## Registration Mode

Use the admin Settings page to change registration mode:

- `single`: first registration only, then closes.
- `open`: anyone who can reach the instance may register.
- `invite`: registration requires an invite code.
- `closed`: no registrations.

For internet-exposed instances, keep registration at `single`, `invite`, or `closed`.

## Audit Logs

Audit logs should record sensitive actions without plaintext content:

- auth success/failure
- vault item CRUD
- host connection attempts
- 2FA enable/disable
- master password rotation
- admin state changes

Terminal content, SSH keys, passwords, AI keys, and vault plaintext must never be logged.

## Operational Checks

After deploy:

```bash
php apps/backend/artisan migrate --force
php apps/backend/artisan queue:work --once
php apps/backend/artisan route:list --path=api/v1
```

Then verify:

- `/api/server-info` returns instance metadata.
- `/admin` rejects non-admin users.
- The first admin can enable TOTP from the client.
- Settings -> Connection can reach the backend.

## User Recovery

Trominal cannot recover a forgotten master password because the server never has the vault key. A login password reset only restores API access; it does not decrypt the vault.

If a user loses the master password, they must create a new vault or restore from a client/device that is still unlocked.
