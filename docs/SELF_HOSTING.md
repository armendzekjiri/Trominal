# Self-Hosting Trominal

Trominal is self-hosted from one Laravel backend plus one client build. The first registered user becomes `admin` and `user`, and registration closes automatically in the default single-user mode.

## Requirements

- PHP 8.4 with `pdo_pgsql`, `redis`, and `sodium`
- Composer 2
- Node 20 and pnpm 9.15.9
- PostgreSQL 16
- Redis 7
- Caddy, Nginx, or another TLS reverse proxy

## Local Development

Start Postgres and Redis:

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

Prepare the backend:

```bash
composer --working-dir apps/backend install
cp apps/backend/.env.example apps/backend/.env
composer --working-dir apps/backend test
php apps/backend/artisan key:generate
php apps/backend/artisan migrate --seed
```

Run the backend and client:

```bash
composer --working-dir apps/backend dev
pnpm --dir apps/client dev
```

Open the client, enter the API base URL, and register the first user.

## Production Build

Build the web client:

```bash
pnpm install --frozen-lockfile
pnpm --dir apps/client build
```

Build and optimize the backend:

```bash
composer --working-dir apps/backend install --no-dev --optimize-autoloader
php apps/backend/artisan config:cache
php apps/backend/artisan route:cache
php apps/backend/artisan migrate --force
```

Run queue workers and Reverb under your process supervisor:

```bash
php apps/backend/artisan queue:work --tries=3
php apps/backend/artisan reverb:start
```

## Environment

Set these backend values for production:

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://trominal.example.com

DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=trominal
DB_USERNAME=trominal
DB_PASSWORD=change-me

REDIS_HOST=127.0.0.1
SESSION_DRIVER=redis
CACHE_STORE=redis
QUEUE_CONNECTION=redis

TROMINAL_REGISTRATION_MODE=single
ALLOWED_ORIGINS=https://trominal.example.com,tauri://localhost
```

Never commit `.env` or production secrets.

## Reverse Proxy

Serve the built web client and proxy API/admin traffic to Laravel:

```caddyfile
trominal.example.com {
  encode zstd gzip

  handle /api/* {
    reverse_proxy 127.0.0.1:8000
  }

  handle /admin* {
    reverse_proxy 127.0.0.1:8000
  }

  handle /livewire/* {
    reverse_proxy 127.0.0.1:8000
  }

  handle /ws/* {
    reverse_proxy 127.0.0.1:8080
  }

  root * /srv/trominal/apps/client/dist
  try_files {path} /index.html
  file_server
}
```

Use HTTPS in production. Desktop clients can point at the same base URL.

## Current v0.1 Transport Notes

- Desktop terminal, tunnels, and SFTP use local OS facilities through Tauri.
- Desktop SSH currently runs through the system `ssh` binary so password and keyboard-interactive prompts work inside the terminal.
- Web SSH, web tunnels, and web SFTP proxying remain planned follow-up work.

## Backups

Back up PostgreSQL and any uploaded operational files. The server stores encrypted vault ciphertext, but losing the database loses the vault.

Recommended minimum:

```bash
pg_dump --format=custom --file=trominal-$(date +%Y%m%d).dump trominal
```

Store backups off-host and test restores before relying on them.
