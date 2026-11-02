<?php

declare(strict_types=1);

namespace App\Services\Ssh;

use InvalidArgumentException;

/**
 * An SSH server host key identified by its OpenSSH SHA-256 fingerprint
 * ("SHA256:" + unpadded base64 of SHA-256 over the wire-format key blob),
 * the same value `ssh-keygen -lf` and OpenSSH's known-hosts prompt show.
 */
final class HostKeyFingerprint
{
    private const PATTERN = '/^SHA256:[A-Za-z0-9+\/]{43}=?$/';

    private function __construct(
        public readonly string $fingerprint,
        public readonly string $keyType,
    ) {
        //
    }

    /**
     * @throws InvalidArgumentException when the blob is not an SSH public key.
     */
    public static function fromBlob(string $blob): self
    {
        if (strlen($blob) < 4) {
            throw new InvalidArgumentException('Malformed SSH host key.');
        }

        /** @var array{1: int} $length */
        $length = unpack('N', substr($blob, 0, 4));
        $typeLength = $length[1];

        if ($typeLength < 1 || $typeLength > 64 || strlen($blob) < 4 + $typeLength) {
            throw new InvalidArgumentException('Malformed SSH host key.');
        }

        $type = substr($blob, 4, $typeLength);

        if (preg_match('/^[A-Za-z0-9@._+-]+$/', $type) !== 1) {
            throw new InvalidArgumentException('Malformed SSH host key.');
        }

        return new self(
            'SHA256:'.rtrim(base64_encode(hash('sha256', $blob, true)), '='),
            $type,
        );
    }

    public static function isWellFormed(string $fingerprint): bool
    {
        return preg_match(self::PATTERN, $fingerprint) === 1;
    }

    /**
     * Constant-time comparison against a pinned fingerprint.
     */
    public function matches(string $pinned): bool
    {
        if (! self::isWellFormed($pinned)) {
            return false;
        }

        return hash_equals($this->fingerprint, rtrim($pinned, '='));
    }
}
