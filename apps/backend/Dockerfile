# syntax=docker/dockerfile:1.7@sha256:a57df69d0ea827fb7266491f2813635de6f17269be881f696fbfdf2d83dda33e

# Base images are pinned to multi-arch index digests; Dependabot (docker ecosystem) bumps them.
# php:8.4-fpm-bookworm
FROM php:8.5-fpm-bookworm@sha256:75dc898a8861a777f14c57b2afbb811a848735701593cbc354e4194807a88f3e AS php-base

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

# composer:2
COPY --from=composer:2@sha256:4ed71c38c6d788eb4e4e3747b5332f5b40d5b5a6fcadd5062a1a70986a118e0a /usr/bin/composer /usr/bin/composer

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

# node:20-bookworm-slim
FROM node:20-bookworm-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0 AS assets

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
