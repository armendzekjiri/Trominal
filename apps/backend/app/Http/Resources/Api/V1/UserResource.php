<?php

declare(strict_types=1);

namespace App\Http\Resources\Api\V1;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin User */
final class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'roles' => $this->roles->pluck('name')->values(),
            'permissions' => $this->getAllPermissions()->pluck('name')->sort()->values(),
            'vault' => self::vaultMaterial($this->resource),
            'two_factor_enabled' => $this->two_fa_enabled_at !== null,
            'suspended_at' => $this->suspended_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }

    /**
     * Encrypted key material the client needs to derive and verify the vault key.
     *
     * @return array<string, mixed>
     */
    public static function vaultMaterial(User $user): array
    {
        return [
            'kdf_salt' => $user->kdf_salt,
            'kdf_params' => $user->kdf_params,
            'public_key' => $user->public_key,
            'private_key_ciphertext' => $user->private_key_ciphertext,
            'private_key_nonce' => $user->private_key_nonce,
            'vault_version' => (int) ($user->vault_version ?? 1),
            'private_key_ad_version' => (int) ($user->private_key_ad_version ?? User::PRIVATE_KEY_AD_EMAIL),
        ];
    }
}
