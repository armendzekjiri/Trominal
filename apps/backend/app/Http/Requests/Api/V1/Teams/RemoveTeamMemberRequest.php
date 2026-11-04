<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1\Teams;

use App\Support\Vault\VaultResourceRegistry;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class RemoveTeamMemberRequest extends FormRequest
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
            'expected_key_version' => ['required', 'integer', 'min:1'],
            'expected_name_ciphertext' => ['required', 'string', 'max:65535'],
            'expected_name_nonce' => ['required', 'string', 'max:128'],
            'name_ciphertext' => ['required', 'string', 'max:65535'],
            'name_nonce' => ['required', 'string', 'max:128'],
            'remaining_members' => ['required', 'array'],
            'remaining_members.*.member_id' => ['required', 'ulid'],
            'remaining_members.*.wrapped_team_key_ciphertext' => ['required', 'string', 'max:65535'],
            'remaining_members.*.wrapped_team_key_nonce' => ['required', 'string', 'max:128'],
            // Brief §5.3 mandates that removing a member re-encrypts every
            // team-scoped vault record under a fresh team key, so the
            // removed user's retained plaintext key is cryptographically
            // useless against future reads. The list is allowed to be
            // empty (team has no records yet); the service rejects
            // mismatches between this list and the team's actual rows.
            'reencrypted_resources' => ['present', 'array'],
            'reencrypted_resources.*.type' => ['required', 'string', Rule::in($resourceTypes)],
            'reencrypted_resources.*.id' => ['required', 'string'],
            'reencrypted_resources.*.original_fields' => ['present', 'array'],
            'reencrypted_resources.*.fields' => ['required', 'array'],
        ];
    }

    /**
     * @return array{
     *     expected_key_version: int,
     *     expected_name_ciphertext: string,
     *     expected_name_nonce: string,
     *     name_ciphertext: string,
     *     name_nonce: string,
     *     remaining_members: list<array{member_id: string, wrapped_team_key_ciphertext: string, wrapped_team_key_nonce: string}>,
     *     reencrypted_resources: list<array{type: string, id: string, original_fields: array<string, mixed>, fields: array<string, mixed>}>
     * }
     */
    public function payload(): array
    {
        /** @var array{
         *     expected_key_version: int,
         *     expected_name_ciphertext: string,
         *     expected_name_nonce: string,
         *     name_ciphertext: string,
         *     name_nonce: string,
         *     remaining_members: list<array{member_id: string, wrapped_team_key_ciphertext: string, wrapped_team_key_nonce: string}>,
         *     reencrypted_resources: list<array{type: string, id: string, original_fields: array<string, mixed>, fields: array<string, mixed>}>
         * } $payload */
        $payload = $this->validated();

        return $payload;
    }
}
