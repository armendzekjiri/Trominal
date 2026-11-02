<?php

declare(strict_types=1);

/*
| Read by Laravel's TrustProxies middleware at request time. Only requests whose
| immediate peer matches one of these IPs / CIDR ranges may set the client IP
| through X-Forwarded-* headers. The default (empty) trusts no proxy, which is
| correct for the bundled Caddy + PHP-FPM setup where PHP sees the real peer.
| Wildcards are intentionally not supported; list your proxies explicitly.
*/

$configured = env('TROMINAL_TRUSTED_PROXIES', '');

return [
    'proxies' => array_values(array_filter(
        array_map(trim(...), explode(',', is_string($configured) ? $configured : '')),
        static fn (string $entry): bool => $entry !== '' && ! str_contains($entry, '*'),
    )),
];
