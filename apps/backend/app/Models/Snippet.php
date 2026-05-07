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
    'title_ciphertext',
    'title_nonce',
    'body_ciphertext',
    'body_nonce',
    'tags_ciphertext',
    'tags_nonce',
    'variables_ciphertext',
    'variables_nonce',
])]
final class Snippet extends Model
{
    use BelongsToVaultUser, HasUlids, SoftDeletes;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'title_ciphertext' => 'encrypted',
            'body_ciphertext' => 'encrypted',
            'tags_ciphertext' => 'encrypted',
            'variables_ciphertext' => 'encrypted',
        ];
    }
}
