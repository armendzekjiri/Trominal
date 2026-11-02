<?php

declare(strict_types=1);

return [
    /*
    |--------------------------------------------------------------------------
    | Trusted Proxies
    |--------------------------------------------------------------------------
    |
    | Comma-separated IPs / CIDR ranges of the reverse proxies allowed to set
    | X-Forwarded-For / -Proto / -Host / -Port. Read by Laravel's TrustProxies
    | middleware on every request. Leave empty when PHP is reached directly.
    |
    | The Docker Compose stack sets this to the private Docker network ranges:
    | PHP-FPM is not published, so only the Caddy container can reach it.
    | Never use '*' on a host where clients can reach PHP directly.
    |
    */

    'proxies' => env('TRUSTED_PROXIES'),
];
