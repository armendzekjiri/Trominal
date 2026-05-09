<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToVaultUser;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'user_id',
    'team_id',
    'host_id',
    'name_ciphertext',
    'name_nonce',
    'config_ciphertext',
    'config_nonce',
    'enabled',
])]
final class Tunnel extends Model
{
    use BelongsToVaultUser, HasUlids, SoftDeletes;

    /**
     * @return BelongsTo<Host, $this>
     */
    public function host(): BelongsTo
    {
        return $this->belongsTo(Host::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'name_ciphertext' => 'encrypted',
            'config_ciphertext' => 'encrypted',
        ];
    }
}
