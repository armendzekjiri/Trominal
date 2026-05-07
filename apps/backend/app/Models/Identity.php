<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToVaultUser;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'user_id',
    'name_ciphertext',
    'name_nonce',
    'key_type',
    'public_key_ciphertext',
    'public_key_nonce',
    'private_key_ciphertext',
    'private_key_nonce',
])]
final class Identity extends Model
{
    use BelongsToVaultUser, HasUlids, SoftDeletes;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'name_ciphertext' => 'encrypted',
            'public_key_ciphertext' => 'encrypted',
            'private_key_ciphertext' => 'encrypted',
        ];
    }
}
