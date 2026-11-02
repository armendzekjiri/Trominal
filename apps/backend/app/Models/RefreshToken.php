<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property string $user_id
 * @property string|null $device_id
 * @property string|null $family_id
 * @property Carbon|null $expires_at
 * @property Carbon|null $rotated_at
 * @property Carbon|null $revoked_at
 */
#[Fillable(['user_id', 'device_id', 'family_id', 'token_hash', 'expires_at', 'rotated_at', 'revoked_at'])]
final class RefreshToken extends Model
{
    use HasUlids;

    /** Lower bound for TROMINAL_REFRESH_TOKEN_EXPIRATION_DAYS. */
    public const MIN_LIFETIME_DAYS = 1;

    /** Upper bound for TROMINAL_REFRESH_TOKEN_EXPIRATION_DAYS. */
    public const MAX_LIFETIME_DAYS = 30;

    /**
     * The configured refresh-token lifetime, clamped to a sane range so a
     * typo in the environment cannot mint near-permanent sessions.
     */
    public static function lifetimeDays(): int
    {
        $configured = (int) config('trominal.refresh_token_expiration_days', 7);

        return max(self::MIN_LIFETIME_DAYS, min(self::MAX_LIFETIME_DAYS, $configured));
    }

    public function isUsable(): bool
    {
        return $this->revoked_at === null
            && $this->rotated_at === null
            && $this->expires_at !== null
            && $this->expires_at->isFuture();
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'rotated_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }
}
