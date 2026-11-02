<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1\Auth;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Starting a first enrollment needs no extra fields. Replacing an active
 * factor must carry the login password and a current code; that requirement
 * is enforced by the service because it depends on the user's 2FA state.
 */
final class TwoFactorEnableRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'password' => ['nullable', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'regex:/^\\d{6}$/'],
        ];
    }
}
