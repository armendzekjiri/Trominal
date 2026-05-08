<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1\Teams;

use Illuminate\Foundation\Http\FormRequest;

final class RemoveTeamMemberRequest extends FormRequest
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
        return [
            'remaining_members' => ['required', 'array'],
            'remaining_members.*.member_id' => ['required', 'ulid'],
            'remaining_members.*.wrapped_team_key_ciphertext' => ['required', 'string', 'max:65535'],
            'remaining_members.*.wrapped_team_key_nonce' => ['required', 'string', 'max:128'],
        ];
    }

    /**
     * @return array{remaining_members: list<array{member_id: string, wrapped_team_key_ciphertext: string, wrapped_team_key_nonce: string}>}
     */
    public function payload(): array
    {
        /** @var array{remaining_members: list<array{member_id: string, wrapped_team_key_ciphertext: string, wrapped_team_key_nonce: string}>} $payload */
        $payload = $this->validated();

        return $payload;
    }
}
