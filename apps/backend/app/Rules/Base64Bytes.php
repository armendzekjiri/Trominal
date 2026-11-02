<?php

declare(strict_types=1);

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Value must be strict standard base64 that decodes to exactly `$length` bytes.
 */
final readonly class Base64Bytes implements ValidationRule
{
    public function __construct(private int $length) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || $value === '') {
            $fail(__('The :attribute must be base64-encoded.'));

            return;
        }

        $decoded = base64_decode($value, true);

        if ($decoded === false || base64_encode($decoded) !== $value) {
            $fail(__('The :attribute must be base64-encoded.'));

            return;
        }

        if (strlen($decoded) !== $this->length) {
            $fail(__('The :attribute must decode to exactly :length bytes.', ['length' => $this->length]));
        }
    }
}
