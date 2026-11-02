<?php

declare(strict_types=1);

namespace App\Services\Ssh\Client;

/**
 * The SSH operations the web SSH proxy needs, behind an interface so the
 * session flow can be tested without a real network connection.
 */
interface WebSshClient
{
    /**
     * IP address of the remote end of the established TCP connection.
     */
    public function peerAddress(): ?string;

    /**
     * Performs the SSH key exchange (without authenticating) and returns the
     * server's public host key blob in SSH wire format, or null when no
     * verified host key could be obtained.
     */
    public function serverHostKey(): ?string;

    public function loginWithPassword(string $username, string $password): bool;

    public function loginWithPrivateKey(string $username, string $privateKeyPem, string $passphrase): bool;

    public function loginWithoutCredentials(string $username): bool;

    public function openShell(int $cols, int $rows): void;

    public function resize(int $cols, int $rows): void;

    /**
     * Returns pending shell output ('' when none). Throws when the channel closed.
     */
    public function read(): string;

    public function write(string $data): void;

    public function disconnect(): void;
}
