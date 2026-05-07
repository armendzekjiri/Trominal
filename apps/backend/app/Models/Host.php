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
    'group_id',
    'name_ciphertext',
    'name_nonce',
    'hostname_ciphertext',
    'hostname_nonce',
    'port_ciphertext',
    'port_nonce',
    'username_ciphertext',
    'username_nonce',
    'tags_ciphertext',
    'tags_nonce',
    'color_ciphertext',
    'color_nonce',
])]
final class Host extends Model
{
    use BelongsToVaultUser, HasUlids, SoftDeletes;

    /**
     * @return BelongsTo<Group, $this>
     */
    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'name_ciphertext' => 'encrypted',
            'hostname_ciphertext' => 'encrypted',
            'port_ciphertext' => 'encrypted',
            'username_ciphertext' => 'encrypted',
            'tags_ciphertext' => 'encrypted',
            'color_ciphertext' => 'encrypted',
        ];
    }
}
