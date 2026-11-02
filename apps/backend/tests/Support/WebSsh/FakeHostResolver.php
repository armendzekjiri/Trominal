<?php

declare(strict_types=1);

namespace Tests\Support\WebSsh;

use App\Services\Ssh\Egress\HostResolver;

final class FakeHostResolver implements HostResolver
{
    /** @var list<string> */
    public array $lookups = [];

    /**
     * @param  array<string, list<string>>  $records
     */
    public function __construct(public array $records = [])
    {
        //
    }

    public function resolve(string $host): array
    {
        $this->lookups[] = $host;

        return $this->records[$host] ?? [];
    }
}
