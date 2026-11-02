<?php

declare(strict_types=1);

return [
    'backend_version' => env('TROMINAL_BACKEND_VERSION', '0.1.0'),
    'api_version' => env('TROMINAL_API_VERSION', 'v1'),
    'min_client_version' => env('TROMINAL_MIN_CLIENT_VERSION', '0.1.0'),
    'registration_mode' => env('TROMINAL_REGISTRATION_MODE', 'single'),
    'access_token_expiration_minutes' => (int) env('TROMINAL_ACCESS_TOKEN_EXPIRATION_MINUTES', 15),
    'refresh_token_expiration_days' => (int) env('TROMINAL_REFRESH_TOKEN_EXPIRATION_DAYS', 7),
    // Base URL of the web client; password-reset emails link to
    // {client_url}/reset-password. Defaults to APP_URL.
    'client_url' => env('TROMINAL_CLIENT_URL'),
    // Optional one-time code the first registration (the one that becomes
    // admin) must present. Leave empty to disable. Never exposed by the API.
    'setup_token' => env('TROMINAL_SETUP_TOKEN'),
    'rate_limits' => [
        // Failed sign-ins tolerated per account and per IP address within the decay window.
        'login_max_attempts' => (int) env('TROMINAL_LOGIN_MAX_ATTEMPTS', 5),
        // Raise this if many users reach the backend from one address (shared NAT,
        // or a proxy that is not forwarding client addresses).
        'login_max_attempts_per_ip' => (int) env('TROMINAL_LOGIN_MAX_ATTEMPTS_PER_IP', env('TROMINAL_LOGIN_MAX_ATTEMPTS', 5)),
        'login_decay_minutes' => (int) env('TROMINAL_LOGIN_DECAY_MINUTES', 15),
        // Failed TOTP codes / step-up passwords tolerated per account within the decay window.
        'two_factor_max_attempts' => (int) env('TROMINAL_TWO_FACTOR_MAX_ATTEMPTS', 5),
        'two_factor_decay_minutes' => (int) env('TROMINAL_TWO_FACTOR_DECAY_MINUTES', 15),
        // Requests per minute to the authenticated /auth/two-factor/* routes, per account.
        'two_factor_requests_per_minute' => (int) env('TROMINAL_TWO_FACTOR_REQUESTS_PER_MINUTE', 10),
        // Refresh-token rotations per minute, per account.
        'refresh_per_minute' => (int) env('TROMINAL_REFRESH_PER_MINUTE', 10),
    ],
    'web_ssh_proxy_url' => env('TROMINAL_WEB_SSH_PROXY_URL'),
    'web_ssh_proxy_host' => env('TROMINAL_WEB_SSH_PROXY_HOST', '127.0.0.1'),
    'web_ssh_proxy_port' => (int) env('TROMINAL_WEB_SSH_PROXY_PORT', 8080),
    'web_ssh_proxy_path' => env('TROMINAL_WEB_SSH_PROXY_PATH', '/ws/ssh'),

    // Bind each single-use web SSH token to the client IP that requested it.
    // When enabled, a connection whose address cannot be determined is refused.
    'web_ssh_bind_ip' => (bool) env('TROMINAL_WEB_SSH_BIND_IP', true),

    // Comma-separated IPs / CIDR ranges whose X-Forwarded-For header the SSH
    // WebSocket proxy trusts (e.g. the reverse proxy in front of it). Empty
    // means forwarding headers are ignored and the TCP peer address is used.
    'web_ssh_trusted_proxies' => env('TROMINAL_WEB_SSH_TRUSTED_PROXIES', ''),

    // Comma-separated CIDR ranges of non-public destinations (private,
    // loopback, link-local, CGNAT, reserved) that web SSH may connect to.
    // Empty (default) means web SSH can only reach public addresses.
    'web_ssh_allowed_cidrs' => env('TROMINAL_WEB_SSH_ALLOWED_CIDRS', ''),
];
