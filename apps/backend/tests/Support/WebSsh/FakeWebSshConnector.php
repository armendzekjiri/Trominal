<?php

declare(strict_types=1);

namespace Tests\Support\WebSsh;

use App\Services\Ssh\Client\WebSshClient;
use App\Services\Ssh\Client\WebSshConnector;
use RuntimeException;

final class FakeWebSshConnector implements WebSshConnector
{
    /** @var list<array{string, int}> */
    public array $connections = [];

    public bool $fail = false;

    public function __construct(public FakeWebSshClient $client)
    {
        //
    }

    public function connect(string $ipAddress, int $port): WebSshClient
    {
        $this->connections[] = [$ipAddress, $port];

        if ($this->fail) {
            throw new RuntimeException('connection refused');
        }

        return $this->client;
    }
}
