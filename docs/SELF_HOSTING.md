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

> **HTTPS is required for anything beyond your own machine.** Clients refuse a plain `http://` server URL unless the host is `localhost`, `127.0.0.1`, `*.localhost` or `*.test`, and web SSH only accepts `wss://` outside those hosts. Use `--domain` (Caddy gets a certificate automatically) or put the stack behind your own TLS proxy — see [HTTPS and reverse proxies](#https-and-reverse-proxies). Never sign in with real credentials over plain HTTP.

Prefer to edit by hand? Copy `docker/env/backend.env.example` to `.env` and set:

- `APP_KEY`: `echo "base64:$(openssl rand -base64 32)"`
- `POSTGRES_PASSWORD` and `DB_PASSWORD`: the same strong password
- `APP_URL` and `ALLOWED_ORIGINS`: the URL you open in the browser (keep `tauri://localhost` in the origins)
- `HTTP_PORT`: host port, if 80 is taken
- `TROMINAL_SITE_ADDRESS`: leave at `:80`, or a bare domain for HTTPS. **Never a port** — Caddy listens on 80/443 inside its container; `HTTP_PORT` picks the host port.
- `TRUSTED_PROXIES`: only if another reverse proxy sits in front of Caddy (see below). The Compose file already trusts the private Docker network ranges, because PHP-FPM is reachable only from the Caddy container.
- `SESSION_SECURE_COOKIE`: leave unset. Session cookies are `Secure` whenever `APP_ENV=production`; set it to `false` only for a throwaway plain-HTTP trial.

Check health:

```bash
curl http://localhost/api/health
curl http://localhost/api/server-info
```

To check the whole stack end to end (fresh install, admin panel, first-user registration, restart), run `./docker/smoke-test.sh`. It uses its own port and volumes and leaves your instance alone; CI runs it on every backend PR.

The production Compose file runs:

- `migrate`: one-shot migrations (and first-boot seeding) before the backend starts
- `app`: Laravel PHP-FPM for `/api`, `/admin`, and Filament/Livewire
- `queue`: Redis queue worker from the same backend image
- `scheduler`: Laravel scheduler from the same backend image
- `ssh-proxy`: WebSocket SSH proxy from the same backend image
- `postgres`: PostgreSQL 16
- `redis`: Redis 7
- `caddy`: the only container with published ports. PHP-FPM speaks FastCGI, not HTTP, so something has to translate browser requests; Caddy does that, serves static assets, routes `/ws/*` to `ssh-proxy`, and gets TLS certificates automatically when `TROMINAL_SITE_ADDRESS` is a domain.

Images are published for `linux/amd64` and `linux/arm64`. Update the backend (with the default `0.1` tag this picks up the latest patch; for a new minor version, change `TROMINAL_BACKEND_IMAGE` in `.env` first):

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

## HTTPS and Reverse Proxies

Every production instance must be served over HTTPS:

- **Caddy terminates TLS (recommended).** Set `TROMINAL_SITE_ADDRESS` to your domain (or run `./docker/setup.sh --domain …`). Caddy gets and renews the certificate, redirects HTTP to HTTPS and sends `Strict-Transport-Security`.
- **Another proxy terminates TLS** (a load balancer, Traefik, Nginx, Cloudflare Tunnel). Keep `TROMINAL_SITE_ADDRESS=:80`, set `APP_URL=https://…`, send HSTS from that proxy, and tell Caddy to trust it so it passes `X-Forwarded-Proto: https` through instead of overwriting it — add a global block at the top of `docker/Caddyfile`:

  ```caddyfile
  {
  	servers {
  		trusted_proxies static 10.0.0.0/8 # the address range of your TLS proxy
  	}
  }
  ```

  Laravel already trusts Caddy (`TRUSTED_PROXIES` in `docker-compose.yml`), so the forwarded scheme and client IP reach the app. Even without this, production web SSH URLs are always `wss://`.

The Docker Caddyfile also sends a Content-Security-Policy: `default-src 'none'` for `/api/*`, and a same-origin policy for the admin panel. Filament's Alpine/Livewire runtime needs `'unsafe-inline'` and `'unsafe-eval'` for scripts there; everything else (connections, frames, forms, plugins) is locked to the instance's own origin.

Check the deployed headers and the generated web SSH URL from outside the server:

```bash
curl -sI https://trominal.example.com/admin/login | grep -iE 'strict-transport|content-security'
# Should print wss://trominal.example.com/ws/ssh?token=… (needs a signed-in access token):
curl -s -X POST https://trominal.example.com/api/v1/ws/ssh-token \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"host_id":"<host id>"}' | grep -o '"websocket_url":"[a-z]*://'
```

## Reverse Proxy

Serve the built web client and proxy API/admin traffic to Laravel. The web client gets the same strict CSP as the desktop app: no inline or eval'd script, and network access only over HTTPS/WSS (plus local development hosts and local AI endpoints such as Ollama):

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

  handle {
    header Strict-Transport-Security "max-age=63072000; includeSubDomains"
    header Content-Security-Policy "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https: wss: http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:*; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'"
    root * /srv/trominal/apps/client/dist
    try_files {path} /index.html
    file_server
  }
}
```

`'wasm-unsafe-eval'` lets libsodium compile its WebAssembly (it does not allow JavaScript `eval`); `style-src 'unsafe-inline'` is needed by xterm.js, which injects its own `<style>` elements. Desktop clients can point at the same base URL.

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
