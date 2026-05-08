<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property string $user_id
 * @property string|null $host_id
 * @property string $token_hash
 * @property string|null $ip_address
 * @property Carbon|null $expires_at
 * @property Carbon|null $consumed_at
 */
#[Fillable(['user_id', 'host_id', 'token_hash', 'ip_address', 'expires_at', 'consumed_at'])]
final class WsSessionToken extends Model
{
    use HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'consumed_at' => 'datetime',
        ];
    }
}
