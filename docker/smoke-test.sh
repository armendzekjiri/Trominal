#!/usr/bin/env sh
# Boots the full Compose stack the way a new self-hoster would (setup.sh + docker compose up)
# and checks the API, admin panel, first-user registration and restart behaviour.
# Runs in a temporary copy with its own project name, port and volumes; removes everything after.
#
#   ./docker/smoke-test.sh                                    # image built from this checkout
#   ./docker/smoke-test.sh ghcr.io/armendzekjiri/trominal-backend:0.1   # a published image
set -eu

cd "$(dirname "$0")/.."

image="${1:-}"
port="${SMOKE_PORT:-8090}"
project="trominal-smoke"
workdir="$(mktemp -d)"
base="http://localhost:$port"

compose() {
    docker compose --project-name "$project" --project-directory "$workdir" -f "$workdir/docker-compose.yml" "$@"
}

cleanup() {
    status=$?
    if [ "$status" -ne 0 ]; then
        echo "--- smoke test failed; container logs:" >&2
        compose logs --no-color --tail 80 >&2 || true
    fi
    compose down -v --remove-orphans >/dev/null 2>&1 || true
    rm -rf "$workdir"
    exit "$status"
}
trap cleanup EXIT INT TERM

fail() {
    echo "FAIL: $*" >&2
    exit 1
}

expect_status() {
    actual="$(curl -s -o /dev/null -w '%{http_code}' "$base$2")"
    [ "$actual" = "$1" ] || fail "GET $2 returned $actual, expected $1"
    echo "ok   GET $2 -> $actual"
}

wait_healthy() {
    echo "waiting for $base/api/health"
    i=0
    until [ "$(curl -s -o /dev/null -w '%{http_code}' "$base/api/health")" = 200 ]; do
        i=$((i + 1))
        [ "$i" -le 90 ] || fail "backend not healthy after 180s"
        sleep 2
    done
}

if [ -z "$image" ]; then
    image="trominal-backend:smoke"
    docker build --target runtime --build-arg TROMINAL_BACKEND_VERSION=smoke \
        -f apps/backend/Dockerfile -t "$image" .
fi

mkdir -p "$workdir/docker/env"
cp docker-compose.yml "$workdir/"
cp docker/Caddyfile docker/setup.sh "$workdir/docker/"
cp docker/env/backend.env.example "$workdir/docker/env/"

"$workdir/docker/setup.sh" --port "$port"
export TROMINAL_BACKEND_IMAGE="$image"
export HTTPS_PORT="${SMOKE_HTTPS_PORT:-8453}"

compose up -d --no-build

wait_healthy

[ "$(docker inspect "$(compose ps -aq migrate)" --format '{{.State.ExitCode}}')" = 0 ] || fail "migrate exited non-zero"
echo "ok   migrate exited 0"

expect_status 200 /api/health
expect_status 200 /api/server-info
expect_status 200 /admin/login
expect_status 200 /favicon.ico

curl -s "$base/api/health" | grep -q '"database":true' || fail "health reports database down"
curl -s "$base/api/health" | grep -q '"redis":true' || fail "health reports redis down"
curl -s "$base/api/server-info" | grep -q '"registration_open":true' || fail "fresh instance should be open for registration"
echo "ok   database, redis, registration open"

if [ "$image" = "trominal-backend:smoke" ]; then
    curl -s "$base/api/server-info" | grep -q '"backend_version":"smoke"' || fail "server-info does not report the image version"
    echo "ok   server-info reports the image version"
fi

roles="$(compose exec -T postgres psql -U trominal -d trominal -tAc 'select count(*) from roles')"
[ "$roles" = 3 ] || fail "expected 3 seeded roles, got $roles"
echo "ok   roles seeded"

password="smoke-$(openssl rand -hex 12)"
key() { openssl rand -base64 "$1" | tr -d '\n'; }
register_status="$(curl -s -o "$workdir/register.json" -w '%{http_code}' -X POST "$base/api/v1/auth/register" \
    -H 'Accept: application/json' -H 'Content-Type: application/json' \
    -d "{\"email\":\"admin@smoke.test\",\"password\":\"$password\",\"password_confirmation\":\"$password\",
        \"kdf_salt\":\"$(key 16)\",\"kdf_params\":{\"version\":1,\"alg\":\"argon2id\",\"memlimit\":67108864,\"opslimit\":3,\"salt_len\":16,\"out_len\":32},
        \"public_key\":\"$(key 32)\",\"private_key_ciphertext\":\"$(key 80)\",\"private_key_nonce\":\"$(key 24)\"}")"
[ "$register_status" = 201 ] || fail "first-user registration returned $register_status: $(cat "$workdir/register.json")"
curl -s "$base/api/server-info" | grep -q '"registration_open":false' || fail "registration still open after first user"
echo "ok   first user registered, registration closed"

compose up -d --force-recreate --no-build migrate app >/dev/null 2>&1
wait_healthy
compose logs --no-color migrate | grep -q 'Seeding' && fail "migrate re-seeded an existing database"
curl -s "$base/api/server-info" | grep -q '"registration_open":false' || fail "restart reopened registration"
echo "ok   restart keeps data and does not re-seed"

echo "PASS: self-hosted stack works on $base"
