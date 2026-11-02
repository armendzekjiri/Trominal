<?php

declare(strict_types=1);

namespace App\Services\Ssh\Egress;

interface HostResolver
{
    /**
     * Resolve a hostname (or IP literal) to the IP addresses it currently
     * points at. Returns an empty list when nothing resolves.
     *
     * @return list<string>
     */
    public function resolve(string $host): array;
}
