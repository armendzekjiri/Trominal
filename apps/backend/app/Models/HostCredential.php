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
    'identity_id',
    'label_ciphertext',
    'label_nonce',
    'username_ciphertext',
    'username_nonce',
    'password_ciphertext',
    'password_nonce',
    'private_key_passphrase_ciphertext',
    'private_key_passphrase_nonce',
])]
final class HostCredential extends Model
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
     * @return BelongsTo<Identity, $this>
     */
    public function identity(): BelongsTo
    {
        return $this->belongsTo(Identity::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'label_ciphertext' => 'encrypted',
            'username_ciphertext' => 'encrypted',
            'password_ciphertext' => 'encrypted',
            'private_key_passphrase_ciphertext' => 'encrypted',
        ];
    }
}
