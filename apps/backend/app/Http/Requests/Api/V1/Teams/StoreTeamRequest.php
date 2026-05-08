<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1\Teams;

use Illuminate\Foundation\Http\FormRequest;

final class StoreTeamRequest extends FormRequest
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
            'id' => ['sometimes', 'ulid'],
            'name_ciphertext' => ['required', 'string', 'max:65535'],
            'name_nonce' => ['required', 'string', 'max:128'],
            'wrapped_team_key_ciphertext' => ['required', 'string', 'max:65535'],
            'wrapped_team_key_nonce' => ['required', 'string', 'max:128'],
        ];
    }

    /**
     * @return array{
     *     id?: string,
     *     name_ciphertext: string,
     *     name_nonce: string,
     *     wrapped_team_key_ciphertext: string,
     *     wrapped_team_key_nonce: string
     * }
     */
    public function payload(): array
    {
        /** @var array{
         *     id?: string,
         *     name_ciphertext: string,
         *     name_nonce: string,
         *     wrapped_team_key_ciphertext: string,
         *     wrapped_team_key_nonce: string
         * } $payload
         */
        $payload = $this->validated();

        return $payload;
    }
}
