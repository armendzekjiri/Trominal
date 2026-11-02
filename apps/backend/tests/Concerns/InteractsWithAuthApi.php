<?php

declare(strict_types=1);

namespace Tests\Concerns;

use Illuminate\Http\JsonResponse;
use Illuminate\Testing\TestResponse;
use PragmaRX\Google2FA\Google2FA;

/**
 * Shared helpers for feature tests that drive the auth API directly.
 */
trait InteractsWithAuthApi
{
    protected static function password(): string
    {
        return 'correct-horse-battery-staple';
    }

    /**
     * @return array<string, mixed>
     */
    protected static function registrationPayload(string $email = 'first@example.test'): array
    {
        return [
            'name' => 'First User',
            'email' => $email,
            'password' => self::password(),
            'password_confirmation' => self::password(),
            'kdf_salt' => base64_encode(str_repeat('s', 16)),
            'kdf_params' => [
                'version' => 1,
                'alg' => 'argon2id',
                'memlimit' => 67108864,
                'opslimit' => 3,
                'salt_len' => 16,
                'out_len' => 32,
            ],
            'public_key' => base64_encode(str_repeat('p', 32)),
            'private_key_ciphertext' => base64_encode(str_repeat('c', 80)),
            'private_key_nonce' => base64_encode(str_repeat('n', 24)),
            'device_name' => 'Feature test',
        ];
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return TestResponse<JsonResponse>
     */
    protected function registerUser(string $email = 'first@example.test', array $overrides = []): TestResponse
    {
        return $this->postJson('/api/v1/auth/register', [
            ...self::registrationPayload($email),
            ...$overrides,
        ]);
    }

    /**
     * @param  array<string, mixed>  $extra
     * @return TestResponse<JsonResponse>
     */
    protected function login(string $email = 'first@example.test', ?string $password = null, array $extra = []): TestResponse
    {
        return $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => $password ?? self::password(),
            ...$extra,
        ]);
    }

    /**
     * @return array{Authorization: string}
     */
    protected function bearer(string $accessToken): array
    {
        // The Sanctum guard caches the resolved user for the lifetime of the
        // test application, so forget it before every switch of credentials.
        $this->app['auth']->forgetGuards();

        return ['Authorization' => 'Bearer '.$accessToken];
    }

    /**
     * The TOTP code for the current 30-second step (driven by the test clock).
     */
    protected static function totp(string $secret, int $stepOffset = 0): string
    {
        return (new Google2FA)->oathTotp($secret, intdiv(now()->getTimestamp(), 30) + $stepOffset);
    }

    /**
     * Move the test clock to the next TOTP step so a fresh code is available.
     */
    protected function nextTotpStep(): void
    {
        $this->travel(30)->seconds();
    }

    /**
     * Register a user, enroll and confirm TOTP, and return the session details.
     *
     * @return array{access_token: string, refresh_token: string, secret: string}
     */
    protected function registerWithTwoFactor(string $email = 'first@example.test'): array
    {
        $registration = $this->registerUser($email)->assertCreated();
        $accessToken = (string) $registration->json('access_token');

        $enable = $this->postJson('/api/v1/auth/two-factor/enable', [], $this->bearer($accessToken))->assertOk();
        $secret = (string) $enable->json('secret');

        $this->postJson('/api/v1/auth/two-factor/verify', [
            'code' => self::totp($secret),
        ], $this->bearer($accessToken))->assertOk();

        $this->nextTotpStep();

        return [
            'access_token' => $accessToken,
            'refresh_token' => (string) $registration->json('refresh_token'),
            'secret' => $secret,
        ];
    }
}
