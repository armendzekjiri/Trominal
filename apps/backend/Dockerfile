# syntax=docker/dockerfile:1.7

FROM php:8.4-fpm-bookworm AS php-base

ARG TROMINAL_BACKEND_VERSION=dev

ENV APP_ENV=production \
    COMPOSER_ALLOW_SUPERUSER=1 \
    TROMINAL_BACKEND_VERSION=${TROMINAL_BACKEND_VERSION}

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        gosu \
        libicu-dev \
        libpq-dev \
        libzip-dev \
        unzip \
    && docker-php-ext-install -j"$(nproc)" intl pcntl pdo_pgsql pgsql zip \
    && pecl install redis \
    && docker-php-ext-enable redis opcache \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

FROM php-base AS vendor

COPY apps/backend/composer.json apps/backend/composer.lock ./
RUN composer install \
    --no-dev \
    --no-autoloader \
    --no-interaction \
    --no-progress \
    --prefer-dist

COPY apps/backend ./
RUN composer dump-autoload \
    --classmap-authoritative \
    --no-dev \
    --no-interaction

FROM node:20-bookworm-slim AS assets

WORKDIR /var/www/html

COPY apps/backend/package.json apps/backend/package-lock.json ./
RUN npm ci --ignore-scripts

COPY apps/backend/vite.config.js ./
COPY apps/backend/resources ./resources
COPY apps/backend/public ./public
RUN npm run build

FROM php-base AS runtime

COPY apps/backend/docker/php.ini /usr/local/etc/php/conf.d/zz-trominal.ini
COPY apps/backend/docker/www.conf /usr/local/etc/php-fpm.d/zz-trominal.conf
COPY --chmod=0755 apps/backend/docker/entrypoint.sh /usr/local/bin/trominal-entrypoint

COPY --from=vendor --chown=www-data:www-data /var/www/html /var/www/html
COPY --from=assets --chown=www-data:www-data /var/www/html/public/build /var/www/html/public/build

RUN mkdir -p \
        /var/www/html/bootstrap/cache \
        /var/www/html/storage/app/private \
        /var/www/html/storage/app/public \
        /var/www/html/storage/framework/cache/data \
        /var/www/html/storage/framework/sessions \
        /var/www/html/storage/framework/views \
        /var/www/html/storage/logs \
    && chown -R www-data:www-data /var/www/html/bootstrap/cache /var/www/html/storage

EXPOSE 9000

ENTRYPOINT ["trominal-entrypoint"]
CMD ["php-fpm"]
