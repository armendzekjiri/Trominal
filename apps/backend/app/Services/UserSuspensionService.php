<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\AdminLockoutException;
use App\Models\AuditLog;
use App\Models\RefreshToken;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The single entry point for suspending and unsuspending accounts.
 *
 * Suspension ends every session the user holds — API access tokens,
 * refresh tokens, database web sessions and remember-me cookies — so that
 * nothing issued before the suspension works again after unsuspension.
 * All of it, plus the audit entry, happens in one transaction.
 */
final class UserSuspensionService
{
    public function __construct(private readonly AdminAccessGuard $adminAccess) {}

    /**
     * @throws AdminLockoutException when suspending yourself or the last usable administrator
     */
    public function suspend(?User $actor, User $target): void
    {
        if ($actor?->is($target) ?? false) {
            throw new AdminLockoutException(__('You cannot suspend your own account.'));
        }

        DB::transaction(function () use ($actor, $target): void {
            $this->adminAccess->lock();

            $target->forceFill([
                'suspended_at' => $target->suspended_at ?? now(),
                'remember_token' => Str::random(60),
            ])->save();

            $accessTokens = $target->tokens()->delete();
            $refreshTokens = RefreshToken::query()
                ->where('user_id', $target->id)
                ->whereNull('revoked_at')
                ->update(['revoked_at' => now()]);
            $webSessions = $this->endWebSessions($target);

            $this->adminAccess->assertAdministrable();

            AuditLog::record($actor, 'admin.user.suspended', 'user', (string) $target->id, [
                'access_tokens_revoked' => $accessTokens,
                'refresh_tokens_revoked' => $refreshTokens,
                'web_sessions_ended' => $webSessions,
            ]);
        });
    }

    public function unsuspend(?User $actor, User $target): void
    {
        DB::transaction(function () use ($actor, $target): void {
            $target->forceFill(['suspended_at' => null])->save();

            AuditLog::record($actor, 'admin.user.unsuspended', 'user', (string) $target->id);
        });
    }

    /**
     * Deletes the user's rows from the database session store (the default
     * driver). Other drivers cannot be enumerated per user; for those the
     * suspended check in the panel middleware and the rotated remember
     * token still apply.
     */
    private function endWebSessions(User $user): int
    {
        $connectionName = config('session.connection');
        $connection = DB::connection(is_string($connectionName) && $connectionName !== '' ? $connectionName : null);
        $table = config('session.table');
        $table = is_string($table) && $table !== '' ? $table : 'sessions';

        if (! $connection->getSchemaBuilder()->hasTable($table)) {
            return 0;
        }

        return $connection->table($table)->where('user_id', $user->id)->delete();
    }
}
