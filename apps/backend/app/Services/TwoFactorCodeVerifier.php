<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Support\Facades\RateLimiter;
use PragmaRX\Google2FA\Google2FA;
use Throwable;

/**
 * Verifies RFC 6238 TOTP codes for the API.
 *
 * - Codes are single use: the accepted time step is stored per user and only
 *   strictly newer steps are accepted afterwards.
 * - Failed codes (and failed step-up passwords) are counted per user; once
 *   the limit is reached every further attempt is refused with 429 until the
 *   window expires, regardless of whether the code would be valid.
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
     * Match a code against a base32 secret without consuming it.
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

    /**
     * Verify a code against the user's active secret and consume its time
     * step atomically, so a code is accepted at most once even under
     * concurrent requests.
     */
    public function verifyAndConsume(User $user, string $code): bool
    {
        $timestep = $this->match($user->two_fa_secret_enc, $code, $user->two_fa_last_used_timestep);

        if ($timestep === null) {
            return false;
        }

        $consumed = User::query()
            ->whereKey($user->getKey())
            ->where(function ($query) use ($timestep): void {
                $query->whereNull('two_fa_last_used_timestep')
                    ->orWhere('two_fa_last_used_timestep', '<', $timestep);
            })
            ->update(['two_fa_last_used_timestep' => $timestep]);

        if ($consumed !== 1) {
            return false;
        }

        $user->forceFill(['two_fa_last_used_timestep' => $timestep])->syncOriginalAttribute('two_fa_last_used_timestep');

        return true;
    }

    /**
     * Refuse further attempts once the user has exhausted their failures.
     *
     * @throws ThrottleRequestsException
     */
    public function ensureNotLockedOut(User $user): void
    {
        $key = $this->failureKey($user);

        if (! RateLimiter::tooManyAttempts($key, $this->maxAttempts())) {
            return;
        }

        AuditLog::record($user, 'auth.2fa.throttled', 'user', (string) $user->id);

        throw new ThrottleRequestsException(
            __('Too many attempts. Try again later.'),
            null,
            ['Retry-After' => RateLimiter::availableIn($key)],
        );
    }

    public function recordFailure(User $user): void
    {
        RateLimiter::hit($this->failureKey($user), $this->decaySeconds());
    }

    public function clearFailures(User $user): void
    {
        RateLimiter::clear($this->failureKey($user));
    }

    public function currentTimestep(): int
    {
        return intdiv(now()->getTimestamp(), self::PERIOD_SECONDS);
    }

    private function failureKey(User $user): string
    {
        return 'two-factor-failures:'.$user->getKey();
    }

    private function maxAttempts(): int
    {
        return max(1, (int) config('trominal.rate_limits.two_factor_max_attempts', 5));
    }

    private function decaySeconds(): int
    {
        return max(1, (int) config('trominal.rate_limits.two_factor_decay_minutes', 15)) * 60;
    }
}
