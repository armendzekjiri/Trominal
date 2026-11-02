<?php

declare(strict_types=1);

namespace App\Rules;

use App\Support\Vault\VaultKeyMaterialRules as Limits;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Argon2id parameters the clients can derive with, within safe resource bounds.
 * Mirrors `isKdfParams` in packages/crypto/src/kdf-params.ts.
 */
final class SupportedKdfParams implements ValidationRule
{
    private const array KEYS = ['alg', 'memlimit', 'opslimit', 'out_len', 'salt_len', 'version'];

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_array($value)) {
            $fail(__('The :attribute must be an object.'));

            return;
        }

        $keys = array_map('strval', array_keys($value));
        sort($keys);

        $valid = $keys === self::KEYS
            && $value['version'] === Limits::KDF_VERSION
            && $value['alg'] === Limits::KDF_ALG
            && self::intBetween($value['memlimit'], Limits::MEMLIMIT_MIN, Limits::MEMLIMIT_MAX)
            && $value['memlimit'] % 1024 === 0
            && self::intBetween($value['opslimit'], Limits::OPSLIMIT_MIN, Limits::OPSLIMIT_MAX)
            && $value['salt_len'] === Limits::SALT_BYTES
            && $value['out_len'] === Limits::KEY_BYTES;

        if (! $valid) {
            $fail(__('The :attribute are not supported key-derivation parameters.'));
        }
    }

    private static function intBetween(mixed $value, int $min, int $max): bool
    {
        return is_int($value) && $value >= $min && $value <= $max;
    }
}
