<?php

declare(strict_types=1);

namespace App\Services\Ssh;

use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

final class WebSshConnectFrame
{
    public function __construct(
        public readonly string $hostId,
        public readonly string $host,
        public readonly int $port,
        public readonly string $username,
        public readonly int $cols,
        public readonly int $rows,
        public readonly ?string $hostKeyFingerprint,
        public readonly ?string $authKind,
        public ?string $password,
        public ?string $privateKeyPemB64,
        public ?string $passphrase,
    ) {
        //
    }

    public static function fromJson(string $payload): self
    {
        $decoded = json_decode($payload, associative: true);

        if (! is_array($decoded)) {
            throw ValidationException::withMessages([
                'payload' => __('The SSH connect frame must be valid JSON.'),
            ]);
        }

        /** @var array<string, mixed> $decoded */
        return self::fromArray($decoded);
    }

    /**
     * @param  array<string, mixed>  $decoded
     */
    public static function fromArray(array $decoded): self
    {
        $validated = Validator::make($decoded, [
            'type' => ['required', 'in:connect'],
            'host_id' => ['required', 'string', 'max:64'],
            'host' => ['required', 'string', 'max:255'],
            'port' => ['required', 'integer', 'min:1', 'max:65535'],
            'username' => ['required', 'string', 'max:255'],
            'cols' => ['required', 'integer', 'min:1', 'max:500'],
            'rows' => ['required', 'integer', 'min:1', 'max:500'],
            // Validated for syntax here; a missing pin is rejected by the
            // session opener with a distinct "host key unknown" error.
            'host_key_fingerprint' => ['nullable', 'string', 'max:64'],
            'auth' => ['nullable', 'array'],
            'auth.kind' => ['required_with:auth', 'in:password,private-key'],
            'auth.password' => ['required_if:auth.kind,password', 'string'],
            'auth.private_key_pem_b64' => ['required_if:auth.kind,private-key', 'string'],
            'auth.passphrase' => ['nullable', 'string'],
        ])->validate();

        /** @var array<string, mixed> $validated */
        $auth = self::optionalArray($validated['auth'] ?? null);

        return new self(
            hostId: self::requiredString($validated, 'host_id'),
            host: self::requiredString($validated, 'host'),
            port: self::requiredInt($validated, 'port'),
            username: self::requiredString($validated, 'username'),
            cols: self::requiredInt($validated, 'cols'),
            rows: self::requiredInt($validated, 'rows'),
            hostKeyFingerprint: self::optionalString($validated['host_key_fingerprint'] ?? null),
            authKind: self::optionalString($auth['kind'] ?? null),
            password: self::optionalString($auth['password'] ?? null),
            privateKeyPemB64: self::optionalString($auth['private_key_pem_b64'] ?? null),
            passphrase: self::optionalString($auth['passphrase'] ?? null),
        );
    }

    public function wipeSecrets(): void
    {
        self::wipeString($this->password);
        self::wipeString($this->privateKeyPemB64);
        self::wipeString($this->passphrase);

        $this->password = null;
        $this->privateKeyPemB64 = null;
        $this->passphrase = null;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private static function requiredString(array $payload, string $key): string
    {
        $value = $payload[$key] ?? null;

        if (! is_string($value)) {
            throw ValidationException::withMessages([
                $key => __('The SSH connect frame is invalid.'),
            ]);
        }

        return $value;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private static function requiredInt(array $payload, string $key): int
    {
        $value = $payload[$key] ?? null;

        if (! is_int($value)) {
            throw ValidationException::withMessages([
                $key => __('The SSH connect frame is invalid.'),
            ]);
        }

        return $value;
    }

    private static function optionalString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        return is_string($value) ? $value : null;
    }

    /**
     * @return array<string, mixed>
     */
    private static function optionalArray(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        /** @var array<string, mixed> $value */
        return $value;
    }

    private static function wipeString(?string $value): void
    {
        if ($value === null) {
            return;
        }

        if (function_exists('sodium_memzero')) {
            sodium_memzero($value);
        }
    }
}
