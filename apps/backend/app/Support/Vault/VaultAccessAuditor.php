<?php

declare(strict_types=1);

namespace App\Support\Vault;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

/**
 * Audit entries for vault reads.
 *
 * Only metadata is recorded — resource type, scope, team id, record id and
 * counts. Ciphertext, nonces, credentials and any other vault payload never
 * reach the audit log.
 *
 * Volume control:
 * - viewing a single record is always recorded;
 * - a full sync, and a delta sync that returns records, is always recorded;
 * - an identical listing (same session, type, scope and count) is recorded
 *   at most once per LIST_COALESCE_SECONDS;
 * - an empty delta-sync poll is recorded at most once per session per
 *   EMPTY_SYNC_COALESCE_SECONDS.
 */
final class VaultAccessAuditor
{
    public const int LIST_COALESCE_SECONDS = 300;

    public const int EMPTY_SYNC_COALESCE_SECONDS = 900;

    public function viewed(User $user, string $type, string $recordId, ?string $teamId): void
    {
        AuditLog::record($user, "vault.{$type}.viewed", $type, $recordId, self::scope($teamId));
    }

    public function listed(User $user, string $type, ?string $teamId, int $count): void
    {
        $metadata = [...self::scope($teamId), 'count' => $count];

        if (! $this->firstInWindow($user, "list:{$type}:".($teamId ?? 'personal').":{$count}", self::LIST_COALESCE_SECONDS)) {
            return;
        }

        AuditLog::record($user, "vault.{$type}.listed", $type, null, $metadata);
    }

    /**
     * @param  array<string, int>  $counts  records returned per resource type
     */
    public function synced(User $user, bool $delta, array $counts, int $teamCount): void
    {
        $counts = array_filter($counts, static fn (int $count): bool => $count > 0);
        $total = array_sum($counts);

        if ($delta && $total === 0 && ! $this->firstInWindow($user, 'sync:empty', self::EMPTY_SYNC_COALESCE_SECONDS)) {
            return;
        }

        AuditLog::record($user, 'vault.synced', 'vault', null, [
            'mode' => $delta ? 'delta' : 'full',
            'total' => $total,
            'counts' => $counts,
            'teams' => $teamCount,
        ]);
    }

    /**
     * @return array{scope: string, team_id?: string}
     */
    private static function scope(?string $teamId): array
    {
        return $teamId === null ? ['scope' => 'personal'] : ['scope' => 'team', 'team_id' => $teamId];
    }

    /**
     * True for the first matching read of this session within the window.
     * Keys contain only identifiers, never vault data.
     */
    private function firstInWindow(User $user, string $suffix, int $seconds): bool
    {
        // Transient (cookie/actingAs) tokens have no id; fall back to the user.
        $tokenId = data_get($user->currentAccessToken(), 'id');
        $session = is_scalar($tokenId) ? (string) $tokenId : 'session';

        return Cache::add("vault-audit:{$user->id}:{$session}:{$suffix}", true, $seconds);
    }
}
