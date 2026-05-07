<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use App\Support\Vault\VaultResourceRegistry;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Http\FormRequest;

final class VaultResourceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        $resource = $this->vaultResource();
        $partial = $this->isMethod('PATCH');
        $rules = [];

        foreach ($resource['fields'] as $field) {
            $rules[$field] = $this->rulesForField(
                $field,
                in_array($field, $resource['required'], true),
                $partial,
            );
        }

        return $rules;
    }

    /**
     * @return array{
     *     model: class-string<Model>,
     *     permissions: array{read: string, create: string, update: string, delete: string},
     *     fields: list<string>,
     *     required: list<string>,
     *     relationship_fields: array<string, class-string<Model>>
     * }
     */
    public function vaultResource(): array
    {
        return VaultResourceRegistry::get($this->vaultType());
    }

    public function vaultType(): string
    {
        $type = $this->route('vaultType');

        return is_string($type) ? $type : '';
    }

    /**
     * @return array<string, mixed>
     */
    public function payload(): array
    {
        /** @var array<string, mixed> $payload */
        $payload = $this->validated();

        return $payload;
    }

    /**
     * @return list<string>
     */
    private function rulesForField(string $field, bool $required, bool $partial): array
    {
        if ($field === 'enabled') {
            return [...$this->presenceRules($required, $partial, nullable: false), 'boolean'];
        }

        if ($field === 'sort_order') {
            return [...$this->presenceRules($required, $partial, nullable: false), 'integer', 'min:0'];
        }

        if (str_ends_with($field, '_id')) {
            return [...$this->presenceRules($required, $partial, nullable: true), 'string'];
        }

        return [...$this->presenceRules($required, $partial, nullable: ! $required), 'string', 'max:65535'];
    }

    /**
     * @return list<string>
     */
    private function presenceRules(bool $required, bool $partial, bool $nullable): array
    {
        if ($partial) {
            return $nullable ? ['sometimes', 'nullable'] : ['sometimes'];
        }

        if ($required) {
            return ['required'];
        }

        return $nullable ? ['nullable'] : ['sometimes'];
    }
}
