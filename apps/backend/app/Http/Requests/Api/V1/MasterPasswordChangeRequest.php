<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Support\Vault\VaultKeyMaterialRules;
use App\Support\Vault\VaultResourceRegistry;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class MasterPasswordChangeRequest extends FormRequest
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
        $resourceTypes = array_keys(VaultResourceRegistry::all());

        return [
            'vault_version' => ['required', 'integer', 'min:1'],
            'current_password' => ['required', 'string', 'max:1024'],
            'two_factor_code' => ['nullable', 'string', 'max:16'],
            'current_refresh_token' => ['required', 'string', 'max:512'],
            'new_kdf_salt' => VaultKeyMaterialRules::salt(),
            'new_kdf_params' => VaultKeyMaterialRules::kdfParams(),
            'private_key_ciphertext' => VaultKeyMaterialRules::privateKeyCiphertext(),
            'private_key_nonce' => VaultKeyMaterialRules::nonce(),
            'items' => ['present', 'array', 'max:50000'],
            'items.*' => ['array:type,id,updated_at,fields'],
            'items.*.type' => ['required', 'string', Rule::in($resourceTypes)],
            'items.*.id' => ['required', 'string', 'max:64'],
            'items.*.updated_at' => ['present', 'nullable', 'string', 'max:64'],
            'items.*.fields' => ['required', 'array', 'min:1'],
        ];
    }

    /**
     * @return array{
     *     vault_version: int,
     *     current_password: string,
     *     two_factor_code: ?string,
     *     current_refresh_token: string,
     *     new_kdf_salt: string,
     *     new_kdf_params: array{version: int, alg: string, memlimit: int, opslimit: int, salt_len: int, out_len: int},
     *     private_key_ciphertext: string,
     *     private_key_nonce: string,
     *     items: list<array{type: string, id: string, updated_at: ?string, fields: array<string, mixed>}>
     * }
     */
    public function payload(): array
    {
        /** @var array<string, mixed> $validated */
        $validated = $this->validated();
        /** @var array<string, mixed> $params */
        $params = $validated['new_kdf_params'];
        /** @var list<array{type: string, id: string, updated_at?: ?string, fields: array<string, mixed>}> $items */
        $items = array_values((array) $validated['items']);

        return [
            'vault_version' => (int) $validated['vault_version'],
            'current_password' => (string) $validated['current_password'],
            'two_factor_code' => isset($validated['two_factor_code']) ? (string) $validated['two_factor_code'] : null,
            'current_refresh_token' => (string) $validated['current_refresh_token'],
            'new_kdf_salt' => (string) $validated['new_kdf_salt'],
            'new_kdf_params' => VaultKeyMaterialRules::normalizeKdfParams($params),
            'private_key_ciphertext' => (string) $validated['private_key_ciphertext'],
            'private_key_nonce' => (string) $validated['private_key_nonce'],
            'items' => array_map(static fn (array $item): array => [
                'type' => $item['type'],
                'id' => $item['id'],
                'updated_at' => $item['updated_at'] ?? null,
                'fields' => $item['fields'],
            ], $items),
        ];
    }
}
