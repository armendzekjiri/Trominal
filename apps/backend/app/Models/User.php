<?php

declare(strict_types=1);

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Filament\Auth\MultiFactor\App\Contracts\HasAppAuthentication;
use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
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
class User extends Authenticatable implements FilamentUser, HasAppAuthentication
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
            'vault_version' => 'integer',
            'suspended_at' => 'datetime',
        ];
    }

    public function canAccessPanel(Panel $panel): bool
    {
        return $panel->getId() === 'admin'
            && $this->suspended_at === null
            && $this->hasRole('admin');
    }

    public function getAppAuthenticationSecret(): ?string
    {
        if ($this->two_fa_enabled_at === null) {
            return null;
        }

        return $this->two_fa_secret_enc;
    }

    public function saveAppAuthenticationSecret(?string $secret): void
    {
        $this->forceFill([
            'two_fa_secret_enc' => $secret,
            'two_fa_enabled_at' => $secret === null ? null : now(),
        ])->save();
    }

    public function getAppAuthenticationHolderName(): string
    {
        return $this->email;
    }
}
