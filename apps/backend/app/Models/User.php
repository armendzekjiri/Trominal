<?php

declare(strict_types=1);

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

#[Fillable([
    'name',
    'email',
    'password',
    'kdf_salt',
    'kdf_params',
    'public_key',
    'private_key_ciphertext',
    'private_key_nonce',
    'two_fa_secret_enc',
    'two_fa_enabled_at',
    'suspended_at',
])]
#[Hidden(['password', 'remember_token', 'two_fa_secret_enc'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, HasUlids, Notifiable, SoftDeletes;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'kdf_params' => 'array',
            'private_key_ciphertext' => 'encrypted',
            'two_fa_secret_enc' => 'encrypted',
            'two_fa_enabled_at' => 'datetime',
            'suspended_at' => 'datetime',
        ];
    }
}
