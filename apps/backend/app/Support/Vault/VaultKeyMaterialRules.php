<?php

declare(strict_types=1);

namespace App\Support\Vault;

use App\Rules\Base64Bytes;
use App\Rules\SupportedKdfParams;

/**
 * Validation for the client-produced vault key material: Argon2id parameters,
 * KDF salt and the user's private-key envelope.
 *
 * Bounds mirror packages/crypto/src/kdf-params.ts. Raising them for a future
 * parameter version means adding a new `version` here and in the client.
 */
final class VaultKeyMaterialRules
{
    public const int KDF_VERSION = 1;

    public const string KDF_ALG = 'argon2id';

    public const int MEMLIMIT_MIN = 64 * 1024 * 1024;

    public const int MEMLIMIT_MAX = 256 * 1024 * 1024;

    public const int OPSLIMIT_MIN = 3;

    public const int OPSLIMIT_MAX = 10;

    public const int SALT_BYTES = 16;

    public const int KEY_BYTES = 32;

    public const int NONCE_BYTES = 24;

    /** X25519 private key (32 bytes) plus the Poly1305 tag (16 bytes). */
    public const int PRIVATE_KEY_CIPHERTEXT_BYTES = 48;

    /** X25519 public key. */
    public const int PUBLIC_KEY_BYTES = 32;

    /**
     * Strictly typed JSON integers only; unknown keys are rejected.
     *
     * @return list<mixed>
     */
    public static function kdfParams(): array
    {
        return ['required', 'array', new SupportedKdfParams];
    }

    /**
     * @return list<mixed>
     */
    public static function salt(): array
    {
        return ['required', 'string', new Base64Bytes(self::SALT_BYTES)];
    }

    /**
     * @return list<mixed>
     */
    public static function privateKeyCiphertext(): array
    {
        return ['required', 'string', new Base64Bytes(self::PRIVATE_KEY_CIPHERTEXT_BYTES)];
    }

    /**
     * @return list<mixed>
     */
    public static function nonce(): array
    {
        return ['required', 'string', new Base64Bytes(self::NONCE_BYTES)];
    }

    /**
     * @return list<mixed>
     */
    public static function publicKey(): array
    {
        return ['required', 'string', new Base64Bytes(self::PUBLIC_KEY_BYTES)];
    }

    /**
     * Canonical, integer-typed copy of already-validated KDF parameters.
     *
     * @param  array<string, mixed>  $params
     * @return array{version: int, alg: string, memlimit: int, opslimit: int, salt_len: int, out_len: int}
     */
    public static function normalizeKdfParams(array $params): array
    {
        return [
            'version' => (int) $params['version'],
            'alg' => (string) $params['alg'],
            'memlimit' => (int) $params['memlimit'],
            'opslimit' => (int) $params['opslimit'],
            'salt_len' => (int) $params['salt_len'],
            'out_len' => (int) $params['out_len'],
        ];
    }
}
