<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property Carbon|null $expires_at
 * @property Carbon|null $rotated_at
 * @property Carbon|null $revoked_at
 */
#[Fillable(['user_id', 'device_id', 'token_hash', 'expires_at', 'rotated_at', 'revoked_at'])]
final class RefreshToken extends Model
{
    use HasUlids;

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
