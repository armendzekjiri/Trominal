<?php

declare(strict_types=1);

namespace App\Services;

use PragmaRX\Google2FA\Google2FA;
use Throwable;

/**
 * Verifies RFC 6238 TOTP codes for the API.
 *
 * The current time step is derived from the application clock (`now()`), so
 * tests can travel in time instead of depending on the wall clock.
 */
final class TwoFactorCodeVerifier
{
    public const PERIOD_SECONDS = 30;

    /** Accept one step either side of "now" to tolerate small clock drift. */
    public const WINDOW = 1;

    /**
     * Match a code against a base32 secret.
     *
     * @param  int|null  $afterTimestep  only accept codes from a strictly newer step
     * @return int|null the matched time step, or null when the code is invalid
     */
    public function match(?string $secret, string $code, ?int $afterTimestep = null): ?int
    {
        if ($secret === null || $secret === '' || preg_match('/^\d{6}$/', $code) !== 1) {
            return null;
        }

        try {
            $result = (new Google2FA)->verifyKeyNewer(
                $secret,
                $code,
                $afterTimestep ?? 0,
                self::WINDOW,
                $this->currentTimestep(),
            );
        } catch (Throwable) {
            return null;
        }

        return is_int($result) ? $result : null;
    }

    public function currentTimestep(): int
    {
        return intdiv(now()->getTimestamp(), self::PERIOD_SECONDS);
    }
}
