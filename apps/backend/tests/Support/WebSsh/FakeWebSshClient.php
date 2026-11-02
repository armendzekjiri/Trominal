<?php

declare(strict_types=1);

namespace Tests\Support\WebSsh;

use App\Services\Ssh\Client\WebSshClient;

final class FakeWebSshClient implements WebSshClient
{
    /** @var list<string> */
    public array $calls = [];

    /** @var list<array{string, string|null}> */
    public array $logins = [];

    public bool $loginResult = true;

    public bool $disconnected = false;

    public function __construct(
        public ?string $peer,
        public ?string $hostKeyBlob,
    ) {
        //
    }

    public function peerAddress(): ?string
    {
        $this->calls[] = 'peerAddress';

        return $this->peer;
    }

    public function serverHostKey(): ?string
    {
        $this->calls[] = 'serverHostKey';

        return $this->hostKeyBlob;
    }

    public function loginWithPassword(string $username, string $password): bool
    {
        $this->calls[] = 'login';
        $this->logins[] = [$username, $password];

        return $this->loginResult;
    }

    public function loginWithPrivateKey(string $username, string $privateKeyPem, string $passphrase): bool
    {
        $this->calls[] = 'login';
        $this->logins[] = [$username, $privateKeyPem];

        return $this->loginResult;
    }

    public function loginWithoutCredentials(string $username): bool
    {
        $this->calls[] = 'login';
        $this->logins[] = [$username, null];

        return $this->loginResult;
    }

    public function openShell(int $cols, int $rows): void
    {
        $this->calls[] = "openShell:{$cols}x{$rows}";
    }

    public function resize(int $cols, int $rows): void
    {
        $this->calls[] = "resize:{$cols}x{$rows}";
    }

    public function read(): string
    {
        return '';
    }

    public function write(string $data): void
    {
        $this->calls[] = 'write';
    }

    public function disconnect(): void
    {
        $this->calls[] = 'disconnect';
        $this->disconnected = true;
    }

    /**
     * Index of the first call with the given name, or null if never called.
     */
    public function callIndex(string $name): ?int
    {
        $index = array_search($name, $this->calls, true);

        return is_int($index) ? $index : null;
    }
}
