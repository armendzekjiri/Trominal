<?php

declare(strict_types=1);

namespace Tests\Support;

use RuntimeException;

/**
 * Test-only mirror of the client's vault crypto (Argon2id + XChaCha20-Poly1305),
 * so feature tests exercise real-shaped ciphertext instead of placeholders.
 */
final class VaultKeyMaterial
{
    public const MEMLIMIT = 67108864;

    public const OPSLIMIT = 3;

    /**
     * @return array{version: int, alg: string, memlimit: int, opslimit: int, salt_len: int, out_len: int}
     */
    public static function kdfParams(): array
    {
        return [
            'version' => 1,
            'alg' => 'argon2id',
            'memlimit' => self::MEMLIMIT,
            'opslimit' => self::OPSLIMIT,
            'salt_len' => 16,
            'out_len' => 32,
        ];
    }

    public static function deriveKey(string $password, string $salt): string
    {
        return sodium_crypto_pwhash(
            32,
            $password,
            $salt,
            self::OPSLIMIT,
            self::MEMLIMIT,
            SODIUM_CRYPTO_PWHASH_ALG_ARGON2ID13,
        );
    }

    public static function ad(string $resourceType, string $resourceId): string
    {
        return "trominal:v1:{$resourceType}:{$resourceId}";
    }

    public static function privateKeyAd(string $userId): string
    {
        return self::ad('user_private_key', $userId);
    }

    public static function legacyPrivateKeyAd(string $email): string
    {
        return self::ad('user_private_key', $email);
    }

    /**
     * @return array{ciphertext: string, nonce: string}
     */
    public static function encrypt(string $plaintext, string $key, string $ad): array
    {
        $nonce = random_bytes(SODIUM_CRYPTO_AEAD_XCHACHA20POLY1305_IETF_NPUBBYTES);
        $ciphertext = sodium_crypto_aead_xchacha20poly1305_ietf_encrypt($plaintext, $ad, $nonce, $key);

        return [
            'ciphertext' => base64_encode($ciphertext),
            'nonce' => base64_encode($nonce),
        ];
    }

    public static function tryDecrypt(string $ciphertext, string $nonce, string $key, string $ad): ?string
    {
        $plaintext = sodium_crypto_aead_xchacha20poly1305_ietf_decrypt(
            base64_decode($ciphertext, true) ?: '',
            $ad,
            base64_decode($nonce, true) ?: '',
            $key,
        );

        return $plaintext === false ? null : $plaintext;
    }

    public static function decrypt(string $ciphertext, string $nonce, string $key, string $ad): string
    {
        $plaintext = self::tryDecrypt($ciphertext, $nonce, $key, $ad);

        if ($plaintext === null) {
            throw new RuntimeException('Decryption failed.');
        }

        return $plaintext;
    }

    /**
     * Re-encrypt every non-null *_ciphertext / *_nonce pair of a serialized record
     * the way the client does during master-password rotation.
     *
     * @param  array<string, mixed>  $record
     * @return array<string, string>
     */
    public static function reEncryptRecordFields(array $record, string $oldKey, string $newKey, string $ad): array
    {
        $fields = [];

        foreach ($record as $field => $value) {
            if (! is_string($value) || ! str_ends_with((string) $field, '_ciphertext')) {
                continue;
            }

            $base = substr((string) $field, 0, -strlen('_ciphertext'));
            $nonce = $record["{$base}_nonce"] ?? null;

            if (! is_string($nonce)) {
                continue;
            }

            $plaintext = self::decrypt($value, $nonce, $oldKey, $ad);
            $envelope = self::encrypt($plaintext, $newKey, $ad);
            $fields["{$base}_ciphertext"] = $envelope['ciphertext'];
            $fields["{$base}_nonce"] = $envelope['nonce'];
        }

        return $fields;
    }
}
