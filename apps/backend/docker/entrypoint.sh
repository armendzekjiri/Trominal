#!/usr/bin/env sh
set -eu

cd /var/www/html

mkdir -p \
    bootstrap/cache \
    storage/app/private \
    storage/app/public \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs

if [ "$(id -u)" = "0" ]; then
    chown -R www-data:www-data bootstrap/cache storage

    if [ -d "${TROMINAL_PUBLIC_MOUNT:-/shared/public}" ]; then
        cp -a public/. "${TROMINAL_PUBLIC_MOUNT:-/shared/public}/"
        chown -R www-data:www-data "${TROMINAL_PUBLIC_MOUNT:-/shared/public}"
    fi

    if [ "${TROMINAL_OPTIMIZE_ON_BOOT:-true}" = "true" ]; then
        gosu www-data php artisan config:cache --no-ansi
        gosu www-data php artisan view:cache --no-ansi
    fi

    command_name="$(basename "${1:-}")"
    if [ "$command_name" = "php-fpm" ] || [ "${command_name#php-fpm}" != "$command_name" ]; then
        # Keep the FPM master as root so it can initialize Docker stderr/stdout,
        # then let the pool drop request workers to www-data via www.conf.
        exec "$@"
    fi

    exec gosu www-data "$@"
fi

if [ "${TROMINAL_OPTIMIZE_ON_BOOT:-true}" = "true" ]; then
    php artisan config:cache --no-ansi
    php artisan view:cache --no-ansi
fi

exec "$@"
