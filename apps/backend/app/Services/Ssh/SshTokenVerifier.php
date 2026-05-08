<?php

declare(strict_types=1);

namespace App\Services\Ssh;

use App\Models\WsSessionToken;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class SshTokenVerifier
{
    public function consume(string $plainToken, ?string $ipAddress): WsSessionToken
    {
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

            if ($token->ip_address !== null && $ipAddress !== null && $token->ip_address !== $ipAddress) {
                throw $this->invalidToken();
            }

            $token->forceFill(['consumed_at' => now()])->save();

            return $token->refresh();
        });
    }

    private function invalidToken(): ValidationException
    {
        return ValidationException::withMessages([
            'token' => __('The SSH session token is invalid or expired.'),
        ]);
    }
}
