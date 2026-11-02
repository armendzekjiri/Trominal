<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Counts failed sign-ins per account (hashed email) and per IP address.
 *
 * Only failures are counted, so legitimate users signing in from several
 * devices are not affected. Both counters live in the default cache store,
 * which is Redis in the Docker deployment, so limits are shared across
 * application workers.
 */
final class LoginRateLimiter
{
    /**
     * @throws ThrottleRequestsException
     */
    public function ensureNotLockedOut(string $email, ?string $ip): void
    {
        foreach ($this->keys($email, $ip) as $scope => $key) {
            if (! RateLimiter::tooManyAttempts($key, $this->maxAttempts())) {
                continue;
            }

            AuditLog::record(null, 'auth.login.throttled', 'user', null, [
                'scope' => $scope,
                'email_hash' => $this->emailHash($email),
            ]);

            throw new ThrottleRequestsException(
                __('Too many sign-in attempts. Try again later.'),
                null,
                ['Retry-After' => RateLimiter::availableIn($key)],
            );
        }
    }

    public function recordFailure(string $email, ?string $ip): void
    {
        foreach ($this->keys($email, $ip) as $key) {
            RateLimiter::hit($key, $this->decaySeconds());
        }
    }

    /**
     * Reset the per-account counter after a successful sign-in. The per-IP
     * counter is left alone so an attacker cannot reset it with their own
     * account.
     */
    public function clearAccount(string $email): void
    {
        RateLimiter::clear($this->accountKey($email));
    }

    /**
     * @return array<string, string>
     */
    private function keys(string $email, ?string $ip): array
    {
        return [
            'account' => $this->accountKey($email),
            'ip' => 'login-failures:ip:'.($ip ?? 'unknown'),
        ];
    }

    private function accountKey(string $email): string
    {
        return 'login-failures:account:'.$this->emailHash($email);
    }

    private function emailHash(string $email): string
    {
        return hash('sha256', mb_strtolower(trim($email)));
    }

    private function maxAttempts(): int
    {
        return max(1, (int) config('trominal.rate_limits.login_max_attempts', 5));
    }

    private function decaySeconds(): int
    {
        return max(1, (int) config('trominal.rate_limits.login_decay_minutes', 15)) * 60;
    }
}
