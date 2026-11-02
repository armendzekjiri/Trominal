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

`setup.sh` also prints a one-time **setup code** (stored in `.env` as `TROMINAL_SETUP_TOKEN`). The first account to register on a new instance becomes the administrator, so the server only accepts that first registration when it carries this code; the client shows a "Setup code" field while it is required. After the first account exists the code is no longer used, and you can remove it from `.env`.

### First-install checklist

1. Keep the instance unreachable from the public internet (firewall or VPN) until the first account exists, even with a setup code.
2. Run `./docker/setup.sh` and note the setup code it prints.
3. `docker compose up -d`, then register the first (admin) account from a client right away, entering the setup code.
4. Confirm `curl http://localhost/api/server-info` reports `"registration_open": false` and `"setup_token_required": false`.
5. Enable two-factor authentication for the admin account (client: Settings → Account), then sign in to `/admin`.
6. Only then open the instance to its intended network.

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
- `TROMINAL_TRUSTED_PROXIES`: only if another reverse proxy sits in front of Caddy (see below). The Compose file already trusts the private Docker network ranges, because PHP-FPM is reachable only from the Caddy container.
- `SESSION_SECURE_COOKIE`: leave unset. Session cookies are `Secure` whenever `APP_ENV=production`; set it to `false` only for a throwaway plain-HTTP trial.
- `TROMINAL_SETUP_TOKEN`: optional but recommended, `openssl rand -hex 16`. Required (compared in constant time) for the first registration only; leave empty to disable.

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
- `ssh-proxy`: WebSocket SSH proxy from the same backend image (only used when web SSH is enabled; see [Web SSH](#web-ssh-disabled-by-default))
- `postgres`: PostgreSQL 16
- `redis`: Redis 7
- `caddy`: the only container with published ports. PHP-FPM speaks FastCGI, not HTTP, so something has to translate browser requests; Caddy does that, serves static assets, routes `/ws/*` to `ssh-proxy`, and gets TLS certificates automatically when `TROMINAL_SITE_ADDRESS` is a domain.

Images are published for `linux/amd64` and `linux/arm64`. Update the backend (with the default `0.1` tag this picks up the latest patch; for a new minor version, change `TROMINAL_BACKEND_IMAGE` in `.env` first):

```bash
docker compose pull
docker compose up -d
```

Upgrade note (auth hardening): the default refresh-token lifetime is now 7 days (`.env` files generated earlier set `TROMINAL_REFRESH_TOKEN_EXPIRATION_DAYS=30`, which is still accepted; values above 30 are clamped). Refresh tokens issued before the upgrade keep working but cannot be linked to their earlier rotations, so reuse detection fully applies from the next sign-in.

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

# Where password-reset emails link to: {TROMINAL_CLIENT_URL}/reset-password?token=…&email=…
# Defaults to APP_URL; set it when the web client is served from another origin.
TROMINAL_CLIENT_URL=https://trominal.example.com
# One-time code for the first (admin) registration; see "First-install checklist".
TROMINAL_SETUP_TOKEN=
# Refresh-token lifetime in days (default 7, clamped to 1-30).
TROMINAL_REFRESH_TOKEN_EXPIRATION_DAYS=7
# Failed sign-ins per account and per IP before a temporary lockout.
TROMINAL_LOGIN_MAX_ATTEMPTS=5
TROMINAL_LOGIN_DECAY_MINUTES=15
```

Rate limits are kept in the cache store, so use `CACHE_STORE=redis` when you run more than one backend worker (the Docker stack does). The per-IP limit relies on the backend seeing real client addresses: Caddy passes them through, but if you put another reverse proxy or CDN in front, every client can appear to come from one address and a few failed sign-ins would lock everyone out. In that case raise `TROMINAL_LOGIN_MAX_ATTEMPTS_PER_IP` (defaults to `TROMINAL_LOGIN_MAX_ATTEMPTS`) or make the proxy forward client addresses. Failed TOTP codes and step-up passwords are limited separately per account (`TROMINAL_TWO_FACTOR_MAX_ATTEMPTS`, default 5 per `TROMINAL_TWO_FACTOR_DECAY_MINUTES`, default 15).

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

  Laravel already trusts Caddy (`TROMINAL_TRUSTED_PROXIES` in `docker-compose.yml`), so the forwarded scheme and client IP reach the app. Even without this, production web SSH URLs are always `wss://`.

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
- The web client's terminal is not available yet. Web tunnels and web SFTP proxying are planned follow-up work.

## Web SSH (disabled by default)

The backend ships a WebSocket SSH proxy (the `ssh-proxy` service) for a future browser terminal. It is **off by default** and stays off unless an admin turns on **Web SSH enabled** under Settings in `/admin`. Leave it off unless you need it. The desktop client is the more secure option.

**If you turn it on, the backend sees SSH credentials in plaintext.** Browsers cannot open raw TCP connections, so the client decrypts the SSH password or private key from the vault and sends it to the proxy over the WebSocket. The proxy keeps it in memory for the length of the session. Anyone who controls the backend (or its code) during a session can read those credentials and the terminal traffic. Web SSH is end-to-end encrypted only between your browser and your server, not zero-knowledge.

What the proxy enforces:

- **Host key pinning.** Every connect must carry the server's expected host key fingerprint (`SHA256:...`, the same format `ssh-keygen -lf` prints), which the client keeps in its encrypted vault. The proxy checks the presented key against it before sending any credential and stops if it doesn't match or no fingerprint was sent. On first use, the client asks the proxy for the presented fingerprint without logging in. You confirm it (compare it with `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` on the server), and the client pins it.
- **Destination binding.** A web SSH token lasts 30 seconds, works once, and is tied to one host entry and the host and port the client said it would connect to. The proxy refuses any other destination.
- **Egress policy.** The proxy resolves the host name once, connects to exactly the address it checked, and confirms that address after connecting. By default it only connects to public addresses. Loopback, link-local (including cloud metadata endpoints such as `169.254.169.254`), private (RFC 1918 / IPv6 ULA), CGNAT (`100.64.0.0/10`), reserved, unspecified and multicast addresses are refused, for IPv4, IPv6 and IPv4 embedded in IPv6.
- **Client IP binding.** The token is tied to the IP that asked for it. The token goes in the first WebSocket message, never in the URL, so it doesn't show up in proxy access logs.
- **Audit log.** Token creation, probes, opened, denied and closed sessions are recorded with the host ID, port, address class and host key fingerprint. Addresses, credentials and terminal content are never logged.

Related settings (backend `.env`):

| Variable                           | Default                                                          | Meaning                                                                                                                                                                                                                                                              |
| ---------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TROMINAL_WEB_SSH_ALLOWED_CIDRS`   | empty                                                            | Comma-separated CIDR ranges of non-public destinations web SSH may reach, e.g. `10.20.0.0/16,fd00:1234::/32`. Add only networks your users are allowed to reach from the server. Unspecified and multicast addresses are never allowed. Invalid entries are ignored. |
| `TROMINAL_WEB_SSH_BIND_IP`         | `true`                                                           | Tie each token to the client IP that asked for it. When on, a connection whose client address can't be determined is refused.                                                                                                                                        |
| `TROMINAL_WEB_SSH_TRUSTED_PROXIES` | empty (`docker-compose.yml` sets private ranges for `ssh-proxy`) | IPs/CIDRs of reverse proxies whose `X-Forwarded-For` the SSH proxy trusts. Otherwise the TCP peer address is used.                                                                                                                                                   |
| `TROMINAL_TRUSTED_PROXIES`         | empty                                                            | IPs/CIDRs of proxies in front of Laravel whose `X-Forwarded-*` headers are trusted. Wildcards are not supported. Set this if a load balancer or CDN sits in front of Caddy, and make sure that proxy overwrites `X-Forwarded-For`.                                   |

The bundled Caddy config overwrites any client-supplied `X-Forwarded-For` with the real peer address. If you put your own proxy in front, configure it the same way, or IP binding will fail closed and refuse connections. For stronger isolation, run `ssh-proxy` on a network segment whose firewall allows outbound traffic only to the SSH hosts you expect.

## Backups

Back up PostgreSQL and any uploaded operational files. The server stores encrypted vault ciphertext, but losing the database loses the vault.

Recommended minimum:

```bash
pg_dump --format=custom --file=trominal-$(date +%Y%m%d).dump trominal
```

Store backups off-host and test restores before relying on them.
