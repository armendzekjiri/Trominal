<?php

declare(strict_types=1);

namespace App\Services\Ssh;

use App\Models\WsSessionToken;
use App\Support\Network\IpAddress;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class SshTokenVerifier
{
    public function consume(string $plainToken, ?string $ipAddress): WsSessionToken
    {
        if (preg_match('/^[a-f0-9]{64}$/', $plainToken) !== 1) {
            throw $this->invalidToken();
        }

        return DB::transaction(function () use ($plainToken, $ipAddress): WsSessionToken {
            /** @var WsSessionToken|null $token */
            $token = WsSessionToken::query()
                ->where('token_hash', hash('sha256', $plainToken))
                ->lockForUpdate()
                ->first();

            if (! $token instanceof WsSessionToken) {
                throw $this->invalidToken();
            }

            if ($token->consumed_at !== null || $token->expires_at === null || $token->expires_at->isPast()) {
                throw $this->invalidToken();
            }

            // When IP binding is on, both addresses must be known and equal.
            // A missing address on either side is treated as a mismatch.
            if ($this->ipBindingEnabled() && ! IpAddress::equals($token->ip_address, $ipAddress)) {
                throw $this->invalidToken();
            }

            $token->forceFill(['consumed_at' => now()])->save();

            return $token->refresh();
        });
    }

    private function ipBindingEnabled(): bool
    {
        return (bool) config('trominal.web_ssh_bind_ip', true);
    }

    private function invalidToken(): ValidationException
    {
        return ValidationException::withMessages([
            'token' => __('The SSH session token is invalid or expired.'),
        ]);
    }
}
