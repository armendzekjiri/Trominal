<?php

declare(strict_types=1);

return [
    'backend_version' => env('TROMINAL_BACKEND_VERSION', '0.1.0'),
    'api_version' => env('TROMINAL_API_VERSION', 'v1'),
    'min_client_version' => env('TROMINAL_MIN_CLIENT_VERSION', '0.1.0'),
    'registration_mode' => env('TROMINAL_REGISTRATION_MODE', 'single'),
    'access_token_expiration_minutes' => (int) env('TROMINAL_ACCESS_TOKEN_EXPIRATION_MINUTES', 15),
    'refresh_token_expiration_days' => (int) env('TROMINAL_REFRESH_TOKEN_EXPIRATION_DAYS', 30),
    'web_ssh_proxy_url' => env('TROMINAL_WEB_SSH_PROXY_URL'),
    'web_ssh_proxy_host' => env('TROMINAL_WEB_SSH_PROXY_HOST', '127.0.0.1'),
    'web_ssh_proxy_port' => (int) env('TROMINAL_WEB_SSH_PROXY_PORT', 8080),
    'web_ssh_proxy_path' => env('TROMINAL_WEB_SSH_PROXY_PATH', '/ws/ssh'),
];
