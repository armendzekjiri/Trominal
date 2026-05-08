<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1\Teams;

use App\Models\TeamMember;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class UpdateTeamMemberRequest extends FormRequest
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
            'role' => ['required', 'string', Rule::in(TeamMember::ROLES)],
        ];
    }

    /**
     * @return array{role: string}
     */
    public function payload(): array
    {
        /** @var array{role: string} $payload */
        $payload = $this->validated();

        return $payload;
    }
}
