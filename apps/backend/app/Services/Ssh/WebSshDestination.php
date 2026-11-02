<?php

declare(strict_types=1);

namespace App\Services\Ssh;

use App\Support\Network\IpAddress;
use InvalidArgumentException;
use RuntimeException;

/**
 * A normalized SSH destination (host + port) as stated by the client.
 *
 * Host addresses are end-to-end encrypted in the vault, so the server cannot
 * read the stored host to bind a token to it. Instead the client states the
 * destination when requesting a token, and the token stores a keyed hash of
 * it; the proxy only connects when the connect frame states the same one.
 */
final class WebSshDestination
{
    private function __construct(
        public readonly string $host,
        public readonly int $port,
    ) {
        //
    }

    /**
     * @throws InvalidArgumentException
     */
    public static function from(string $host, int $port): self
    {
        if ($port < 1 || $port > 65535) {
            throw new InvalidArgumentException('Invalid SSH port.');
        }

        $candidate = trim($host);
        $literal = IpAddress::normalize($candidate);

        if ($literal !== null) {
            return new self($literal, $port);
        }

        $name = rtrim(strtolower($candidate), '.');

        if (
            $name === ''
            || strlen($name) > 253
            || filter_var($name, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME) === false
        ) {
            throw new InvalidArgumentException('Invalid SSH host.');
        }

        return new self($name, $port);
    }

    public static function isValid(string $host, int $port): bool
    {
        try {
            self::from($host, $port);
        } catch (InvalidArgumentException) {
            return false;
        }

        return true;
    }

    public function bindingHash(string $key): string
    {
        if ($key === '') {
            throw new RuntimeException('A key is required to bind SSH destinations.');
        }

        return hash_hmac('sha256', "trominal-web-ssh-destination\n{$this->host}\n{$this->port}", $key);
    }

    public function matches(?string $hash, string $key): bool
    {
        if ($hash === null || $hash === '') {
            return false;
        }

        return hash_equals($hash, $this->bindingHash($key));
    }

    public static function appKey(): string
    {
        $key = config('app.key');

        return is_string($key) ? $key : '';
    }
}
