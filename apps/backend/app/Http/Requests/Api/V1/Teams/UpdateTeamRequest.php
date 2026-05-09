<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1\Teams;

use Illuminate\Foundation\Http\FormRequest;

final class UpdateTeamRequest extends FormRequest
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
            'name_ciphertext' => ['required', 'string', 'max:65535'],
            'name_nonce' => ['required', 'string', 'max:128'],
        ];
    }

    /**
     * @return array{name_ciphertext: string, name_nonce: string}
     */
    public function payload(): array
    {
        /** @var array{name_ciphertext: string, name_nonce: string} $payload */
        $payload = $this->validated();

        return $payload;
    }
}
