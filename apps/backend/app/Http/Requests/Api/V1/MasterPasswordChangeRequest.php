<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

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
            'new_kdf_salt' => ['required', 'string', 'max:512'],
            'new_kdf_params' => ['required', 'array'],
            'current_refresh_token' => ['required', 'string'],
            'items' => ['required', 'array'],
            'items.*.type' => ['required', 'string', Rule::in($resourceTypes)],
            'items.*.id' => ['required', 'string'],
            'items.*.fields' => ['required', 'array'],
        ];
    }

    /**
     * @return array{
     *     new_kdf_salt: string,
     *     new_kdf_params: array<string, mixed>,
     *     current_refresh_token: string,
     *     items: list<array{type: string, id: string, fields: array<string, mixed>}>
     * }
     */
    public function payload(): array
    {
        /** @var array{
         *     new_kdf_salt: string,
         *     new_kdf_params: array<string, mixed>,
         *     current_refresh_token: string,
         *     items: list<array{type: string, id: string, fields: array<string, mixed>}>
         * } $payload
         */
        $payload = $this->validated();

        return $payload;
    }
}
