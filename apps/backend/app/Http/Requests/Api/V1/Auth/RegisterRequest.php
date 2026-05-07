<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

final class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['nullable', 'string', 'max:255'],
            'email' => ['required', 'email:rfc', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::min(12)],
            'kdf_salt' => ['required', 'string', 'max:512'],
            'kdf_params' => ['required', 'array'],
            'public_key' => ['required', 'string', 'max:4096'],
            'private_key_ciphertext' => ['required', 'string', 'max:65535'],
            'private_key_nonce' => ['required', 'string', 'max:512'],
            'device_name' => ['nullable', 'string', 'max:255'],
        ];
    }
}
