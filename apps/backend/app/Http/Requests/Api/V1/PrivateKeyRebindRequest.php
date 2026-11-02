<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Support\Vault\VaultKeyMaterialRules;
use Illuminate\Foundation\Http\FormRequest;

final class PrivateKeyRebindRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'vault_version' => ['required', 'integer', 'min:1'],
            'private_key_ciphertext' => VaultKeyMaterialRules::privateKeyCiphertext(),
            'private_key_nonce' => VaultKeyMaterialRules::nonce(),
        ];
    }
}
