<?php

declare(strict_types=1);

namespace App\Services\Ssh\Client;

use phpseclib3\Crypt\PublicKeyLoader;
use phpseclib3\Net\SSH2;
use RuntimeException;

final class PhpseclibWebSshClient implements WebSshClient
{
    public function __construct(
        private readonly SSH2 $ssh,
        private readonly ?string $peerAddress,
    ) {
        //
    }

    public function peerAddress(): ?string
    {
        return $this->peerAddress;
    }

    public function serverHostKey(): ?string
    {
        // Runs the key exchange and verifies the exchange-hash signature
        // against the presented host key. No authentication happens here.
        $key = $this->ssh->getServerPublicHostKey();

        if (! is_string($key) || ! str_contains($key, ' ')) {
            return null;
        }

        [, $encoded] = explode(' ', $key, 2);
        $blob = base64_decode($encoded, true);

        return is_string($blob) && $blob !== '' ? $blob : null;
    }

    public function loginWithPassword(string $username, string $password): bool
    {
        return $this->ssh->login($username, $password);
    }

    public function loginWithPrivateKey(string $username, string $privateKeyPem, string $passphrase): bool
    {
        $key = PublicKeyLoader::loadPrivateKey($privateKeyPem, $passphrase);

        return $this->ssh->login($username, $key);
    }

    public function loginWithoutCredentials(string $username): bool
    {
        return $this->ssh->login($username);
    }

    public function openShell(int $cols, int $rows): void
    {
        $this->ssh->setWindowSize($cols, $rows);
        $this->ssh->setTimeout(0.05);

        if (! $this->ssh->openShell()) {
            throw new RuntimeException('Unable to open an SSH shell.');
        }
    }

    public function resize(int $cols, int $rows): void
    {
        $this->ssh->setWindowSize($cols, $rows);
    }

    public function read(): string
    {
        $chunk = $this->ssh->read('', SSH2::READ_NEXT);

        return is_string($chunk) ? $chunk : '';
    }

    public function write(string $data): void
    {
        $this->ssh->write($data);
    }

    public function disconnect(): void
    {
        $this->ssh->disconnect();
    }
}
