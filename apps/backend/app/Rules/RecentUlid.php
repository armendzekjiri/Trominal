<?php

declare(strict_types=1);

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Symfony\Component\Uid\Ulid;

/**
 * Client-generated ULID whose timestamp is close to the server clock.
 *
 * Used for IDs the client must know before the row exists (so it can bind
 * associated data to them). The time window stops a client from choosing an
 * old identifier that may still be referenced by historical rows.
 */
final readonly class RecentUlid implements ValidationRule
{
    public function __construct(private int $toleranceSeconds = 600) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || ! Ulid::isValid($value)) {
            $fail(__('The :attribute must be a valid ULID.'));

            return;
        }

        $timestamp = Ulid::fromString($value)->getDateTime()->getTimestamp();

        if (abs(now()->getTimestamp() - $timestamp) > $this->toleranceSeconds) {
            $fail(__('The :attribute must be a freshly generated ULID.'));
        }
    }
}
