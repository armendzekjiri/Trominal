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
    'provider_ciphertext',
    'provider_nonce',
    'model_ciphertext',
    'model_nonce',
    'api_key_ciphertext',
    'api_key_nonce',
    'settings_ciphertext',
    'settings_nonce',
])]
final class AiSetting extends Model
{
    use BelongsToVaultUser, HasUlids, SoftDeletes;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'provider_ciphertext' => 'encrypted',
            'model_ciphertext' => 'encrypted',
            'api_key_ciphertext' => 'encrypted',
            'settings_ciphertext' => 'encrypted',
        ];
    }
}
