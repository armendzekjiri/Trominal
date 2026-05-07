<?php

declare(strict_types=1);

/*
 * Cross-Origin Resource Sharing (CORS) configuration.
 *
 * Trominal's API is consumed by the Tauri+React client at a different origin
 * (the Vite dev server in dev, the bundled web app in prod). Default Laravel
 * does not enable CORS in fresh installs, so we publish this config and wire
 * `HandleCors` middleware in bootstrap/app.php.
 *
 * Allowed origins should be tightened per deployment via the env-driven
 * allowlist below; the dev defaults cover the local Tauri/Vite ports only.
 */

$rawAllowed = (string) env('ALLOWED_ORIGINS', 'http://localhost:1420,http://127.0.0.1:1420,tauri://localhost');

$allowedOrigins = array_values(array_filter(array_map('trim', explode(',', $rawAllowed))));

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => $allowedOrigins,

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    // No cookies on the API — clients use Sanctum bearer tokens.
    'supports_credentials' => false,
];
