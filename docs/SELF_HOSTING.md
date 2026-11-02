# Self-Hosting Trominal

Trominal is self-hosted from one Laravel backend plus one client build. The backend can run by itself for API and `/admin` work; the first registered user becomes `admin` and `user`, and registration closes automatically in the default single-user mode.

## Requirements

- PHP 8.4 with `pdo_pgsql`, `redis`, and `sodium`
- Composer 2
- Node 20 and pnpm 9.15.9
- PostgreSQL 16
- Redis 7
- Caddy, Nginx, or another TLS reverse proxy

For the Docker backend package, Docker Engine with the Compose plugin is enough.

## Backend Docker Deployment

Generate `.env` (random `APP_KEY` and database password), then start the stack:

```bash
./docker/setup.sh                 # http://localhost
docker compose up -d
```

That's it. Migrations run automatically on every `up`; roles and default settings are seeded only on the first boot. Open `http://localhost/admin` once you've registered the first user from a client.

Other setups:

```bash
./docker/setup.sh --port 8031                     # port 80 is taken → http://localhost:8031
./docker/setup.sh --domain trominal.example.com   # public server, automatic HTTPS via Let's Encrypt
```

For `--domain`, point the domain's DNS at the server and open ports 80 and 443 first. If `.env` already exists, `setup.sh` leaves it alone apart from filling an empty `APP_KEY`.

Prefer to edit by hand? Copy `docker/env/backend.env.example` to `.env` and set:

- `APP_KEY`: `echo "base64:$(openssl rand -base64 32)"`
- `POSTGRES_PASSWORD` and `DB_PASSWORD`: the same strong password
- `APP_URL` and `ALLOWED_ORIGINS`: the URL you open in the browser (keep `tauri://localhost` in the origins)
- `HTTP_PORT`: host port, if 80 is taken
- `TROMINAL_SITE_ADDRESS`: leave at `:80`, or a bare domain for HTTPS. **Never a port** — Caddy listens on 80/443 inside its container; `HTTP_PORT` picks the host port.

Check health:

```bash
curl http://localhost/api/health
curl http://localhost/api/server-info
```

The production Compose file runs:

- `migrate`: one-shot migrations (and first-boot seeding) before the backend starts
- `app`: Laravel PHP-FPM for `/api`, `/admin`, and Filament/Livewire
- `queue`: Redis queue worker from the same backend image
- `scheduler`: Laravel scheduler from the same backend image
- `ssh-proxy`: WebSocket SSH proxy from the same backend image
- `postgres`: PostgreSQL 16
- `redis`: Redis 7
- `caddy`: the only container with published ports. PHP-FPM speaks FastCGI, not HTTP, so something has to translate browser requests; Caddy does that, serves static assets, routes `/ws/*` to `ssh-proxy`, and gets TLS certificates automatically when `TROMINAL_SITE_ADDRESS` is a domain.

Update the backend: set the new `TROMINAL_BACKEND_IMAGE` tag in `.env`, then:

```bash
docker compose pull
docker compose up -d
```

Backend tags use `backend-vX.Y.Z`. Client tags use `client-vX.Y.Z`; they do not need to match.

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

Build the web client when releasing or deploying the client:

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
TROMINAL_BACKEND_VERSION=0.1.0
TROMINAL_API_VERSION=v1
TROMINAL_MIN_CLIENT_VERSION=0.1.0
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
