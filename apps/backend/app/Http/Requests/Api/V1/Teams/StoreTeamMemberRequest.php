<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1\Teams;

use App\Models\TeamMember;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreTeamMemberRequest extends FormRequest
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
            'user_id' => ['required', 'ulid', 'exists:users,id'],
            'role' => ['required', 'string', Rule::in(TeamMember::ROLES)],
            'wrapped_team_key_ciphertext' => ['required', 'string', 'max:65535'],
            'wrapped_team_key_nonce' => ['required', 'string', 'max:128'],
        ];
    }

    /**
     * @return array{
     *     user_id: string,
     *     role: string,
     *     wrapped_team_key_ciphertext: string,
     *     wrapped_team_key_nonce: string
     * }
     */
    public function payload(): array
    {
        /** @var array{
         *     user_id: string,
         *     role: string,
         *     wrapped_team_key_ciphertext: string,
         *     wrapped_team_key_nonce: string
         * } $payload
         */
        $payload = $this->validated();

        return $payload;
    }
}
