#!/usr/bin/env sh
# Prepares .env for the Docker Compose stack: copies the template and fills in secrets.
#
#   ./docker/setup.sh                                  # http://localhost
#   ./docker/setup.sh --port 8031                      # http://localhost:8031
#   ./docker/setup.sh --domain trominal.example.com    # https://… with automatic TLS
#
# An existing .env is kept: only an empty APP_KEY, a bad TROMINAL_SITE_ADDRESS and a stale
# TROMINAL_BACKEND_VERSION are fixed.
set -eu

cd "$(dirname "$0")/.."
umask 077

port=80
domain=

while [ $# -gt 0 ]; do
    case "$1" in
        --port) port="$2"; shift 2 ;;
        --domain) domain="$2"; shift 2 ;;
        -h | --help) sed -n '2,9p' "$0"; exit 0 ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

set_env() {
    awk -v key="$1" -v value="$2" -F= '$1 == key { print key "=" value; next } { print }' .env > .env.tmp
    mv .env.tmp .env
}

get_env() {
    awk -F= -v key="$1" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' .env
}

if [ -f .env ]; then
    if [ -z "$(get_env APP_KEY)" ]; then
        set_env APP_KEY "base64:$(openssl rand -base64 32)"
        echo "Filled the empty APP_KEY in .env."
    fi

    # Caddy listens on :80 inside the container; the host port is HTTP_PORT, not the site address.
    site_address="$(get_env TROMINAL_SITE_ADDRESS)"
    case "$site_address" in
        :80 | "") ;;
        :*)
            set_env TROMINAL_SITE_ADDRESS ":80"
            echo "Changed TROMINAL_SITE_ADDRESS from $site_address to :80 (use HTTP_PORT for the host port)."
            ;;
    esac

    # The image carries its own version; an .env value would make /api/server-info misreport it.
    if grep -q '^TROMINAL_BACKEND_VERSION=' .env; then
        grep -v '^TROMINAL_BACKEND_VERSION=' .env > .env.tmp
        mv .env.tmp .env
        echo "Removed TROMINAL_BACKEND_VERSION from .env (the image reports its own version)."
    fi

    echo ".env already exists; other values left untouched."
    exit 0
fi

cp docker/env/backend.env.example .env

db_password="$(openssl rand -hex 24)"
set_env APP_KEY "base64:$(openssl rand -base64 32)"
set_env POSTGRES_PASSWORD "$db_password"
set_env DB_PASSWORD "$db_password"

if [ -n "$domain" ]; then
    url="https://$domain"
    set_env TROMINAL_SITE_ADDRESS "$domain"
else
    url="http://localhost"
    [ "$port" = 80 ] || url="$url:$port"
    set_env HTTP_PORT "$port"
fi

set_env APP_URL "$url"
set_env ALLOWED_ORIGINS "$url,tauri://localhost"

echo "Wrote .env for $url"
echo "Next: docker compose up -d"
