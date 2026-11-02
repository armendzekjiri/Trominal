<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1\Auth;

use App\Rules\RecentUlid;
use App\Support\Vault\VaultKeyMaterialRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

final class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            // Optional client-generated, lower-case user ULID. When present the
            // client bound the private-key envelope's associated data to it.
            'id' => ['sometimes', 'string', 'regex:/^[0-9a-hjkmnp-tv-z]{26}$/', new RecentUlid, 'unique:users,id'],
            'name' => ['nullable', 'string', 'max:255'],
            'email' => ['required', 'email:rfc', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::min(12)],
            'kdf_salt' => VaultKeyMaterialRules::salt(),
            'kdf_params' => VaultKeyMaterialRules::kdfParams(),
            'public_key' => VaultKeyMaterialRules::publicKey(),
            'private_key_ciphertext' => VaultKeyMaterialRules::privateKeyCiphertext(),
            'private_key_nonce' => VaultKeyMaterialRules::nonce(),
            'device_name' => ['nullable', 'string', 'max:255'],
            'invite_code' => ['nullable', 'string', 'min:32', 'max:128'],
        ];
    }
}
