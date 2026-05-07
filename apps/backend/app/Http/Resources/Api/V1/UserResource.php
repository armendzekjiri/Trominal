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
            'vault' => [
                'kdf_salt' => $this->kdf_salt,
                'kdf_params' => $this->kdf_params,
                'public_key' => $this->public_key,
                'private_key_ciphertext' => $this->private_key_ciphertext,
                'private_key_nonce' => $this->private_key_nonce,
            ],
            'two_factor_enabled' => $this->two_fa_enabled_at !== null,
            'suspended_at' => $this->suspended_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
