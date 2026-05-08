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
    'parent_id',
    'name_ciphertext',
    'name_nonce',
    'color_ciphertext',
    'color_nonce',
    'sort_order',
])]
final class Group extends Model
{
    use BelongsToVaultUser, HasUlids, SoftDeletes;

    /**
     * @return BelongsTo<self, $this>
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'name_ciphertext' => 'encrypted',
            'color_ciphertext' => 'encrypted',
        ];
    }
}
