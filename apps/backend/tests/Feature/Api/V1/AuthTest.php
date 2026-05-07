<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Models\AppSetting;
use App\Models\AuditLog;
use App\Models\RefreshToken;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

final class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
    }

    public function test_registers_the_first_user_as_admin_and_user_then_closes_single_user_registration(): void
    {
        $response = $this->postJson('/api/v1/auth/register', self::validRegistrationPayload());

        $response
            ->assertCreated()
            ->assertJsonStructure([
                'user' => ['id', 'email', 'roles', 'permissions', 'vault'],
                'access_token',
                'refresh_token',
                'token_type',
                'expires_in',
            ])
            ->assertJsonPath('user.email', 'first@example.test')
            ->assertJsonPath('token_type', 'Bearer');

        /** @var User $user */
        $user = User::query()->where('email', 'first@example.test')->firstOrFail();
        $roles = $response->json('user.roles');
        $permissions = $response->json('user.permissions');

        self::assertIsArray($roles);
        self::assertIsArray($permissions);
        self::assertTrue($user->hasRole('admin'));
        self::assertTrue($user->hasRole('user'));
        self::assertContains('admin', $roles);
        self::assertContains('user', $roles);
        self::assertContains('admin.users.manage', $permissions);
        self::assertContains('hosts.connect', $permissions);
        self::assertFalse((bool) AppSetting::registration()->value['open']);
        self::assertSame(1, AuditLog::query()->where('action', 'auth.registered')->count());
    }

    public function test_rejects_a_second_registration_in_single_user_mode(): void
    {
        $this->postJson('/api/v1/auth/register', self::validRegistrationPayload())->assertCreated();

        $this->postJson('/api/v1/auth/register', self::validRegistrationPayload('second@example.test'))
            ->assertForbidden();

        self::assertSame(1, User::query()->count());
    }

    public function test_validates_registration_payloads(): void
    {
        $this->postJson('/api/v1/auth/register', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'email',
                'password',
                'kdf_salt',
                'kdf_params',
                'public_key',
                'private_key_ciphertext',
                'private_key_nonce',
            ]);
    }

    public function test_logs_in_with_valid_credentials_and_records_failed_attempts_without_plaintext_email_metadata(): void
    {
        $this->postJson('/api/v1/auth/register', self::validRegistrationPayload())->assertCreated();

        $this->postJson('/api/v1/auth/login', [
            'email' => 'first@example.test',
            'password' => 'wrong-password',
        ])->assertUnprocessable();

        $this->postJson('/api/v1/auth/login', [
            'email' => 'first@example.test',
            'password' => self::validPassword(),
            'device_name' => 'MacBook',
        ])->assertOk()
            ->assertJsonStructure(['access_token', 'refresh_token', 'user']);

        /** @var AuditLog $failedLog */
        $failedLog = AuditLog::query()->where('action', 'auth.login.failed')->firstOrFail();

        self::assertSame(1, AuditLog::query()->where('action', 'auth.login.succeeded')->count());
        self::assertIsArray($failedLog->metadata);
        self::assertArrayHasKey('email_hash', $failedLog->metadata);
        self::assertNotContains('first@example.test', $failedLog->metadata);
    }

    public function test_returns_the_authenticated_user_and_logs_out_the_current_access_path(): void
    {
        $registration = $this->postJson('/api/v1/auth/register', self::validRegistrationPayload());
        $registration->assertCreated();

        $headers = self::bearerHeaders((string) $registration->json('access_token'));

        $this->getJson('/api/v1/me', $headers)
            ->assertOk()
            ->assertJsonPath('data.email', 'first@example.test')
            ->assertJsonPath('data.two_factor_enabled', false);

        $this->postJson('/api/v1/auth/logout', [], $headers)->assertOk();
        auth()->forgetGuards();

        $this->getJson('/api/v1/me', $headers)->assertUnauthorized();

        self::assertTrue(AuditLog::query()->where('action', 'auth.logout')->exists());
    }

    public function test_rotates_refresh_tokens_and_rejects_reused_refresh_tokens(): void
    {
        $registration = $this->postJson('/api/v1/auth/register', self::validRegistrationPayload());
        $registration->assertCreated();

        $oldRefreshToken = (string) $registration->json('refresh_token');

        $this->postJson('/api/v1/auth/refresh', [
            'refresh_token' => $oldRefreshToken,
            'device_name' => 'Second session',
        ])->assertOk()
            ->assertJsonStructure(['access_token', 'refresh_token']);

        $this->postJson('/api/v1/auth/refresh', [
            'refresh_token' => $oldRefreshToken,
        ])->assertUnprocessable();

        self::assertSame(1, RefreshToken::query()->whereNotNull('rotated_at')->count());
        self::assertSame(1, AuditLog::query()->where('action', 'auth.token.refreshed')->count());
    }

    public function test_handles_forgot_and_reset_password_flows(): void
    {
        $this->postJson('/api/v1/auth/register', self::validRegistrationPayload())->assertCreated();

        /** @var User $user */
        $user = User::query()->where('email', 'first@example.test')->firstOrFail();
        $token = Password::createToken($user);

        $this->postJson('/api/v1/auth/forgot-password', [
            'email' => 'first@example.test',
        ])->assertAccepted();

        $this->postJson('/api/v1/auth/reset-password', [
            'email' => 'first@example.test',
            'token' => $token,
            'password' => 'new-correct-horse-password',
            'password_confirmation' => 'new-correct-horse-password',
        ])->assertOk();

        $user->refresh();

        self::assertTrue(Hash::check('new-correct-horse-password', $user->password));
        self::assertTrue(AuditLog::query()->where('action', 'auth.password_reset.requested')->exists());
        self::assertTrue(AuditLog::query()->where('action', 'auth.password.reset')->exists());
    }

    public function test_enables_verifies_requires_and_disables_two_factor_authentication(): void
    {
        $registration = $this->postJson('/api/v1/auth/register', self::validRegistrationPayload());
        $registration->assertCreated();

        $headers = self::bearerHeaders((string) $registration->json('access_token'));

        $enable = $this->postJson('/api/v1/auth/two-factor/enable', [], $headers);
        $enable->assertOk()->assertJsonStructure(['secret', 'otpauth_uri']);

        $secret = (string) $enable->json('secret');
        $code = (new Google2FA)->getCurrentOtp($secret);

        $this->postJson('/api/v1/auth/two-factor/verify', [
            'code' => $code,
        ], $headers)->assertOk();

        $this->postJson('/api/v1/auth/login', [
            'email' => 'first@example.test',
            'password' => self::validPassword(),
        ])->assertUnprocessable();

        $this->postJson('/api/v1/auth/login', [
            'email' => 'first@example.test',
            'password' => self::validPassword(),
            'two_factor_code' => $code,
        ])->assertOk();

        $this->postJson('/api/v1/auth/two-factor/disable', [
            'password' => self::validPassword(),
            'code' => $code,
        ], $headers)->assertOk();

        $this->postJson('/api/v1/auth/login', [
            'email' => 'first@example.test',
            'password' => self::validPassword(),
        ])->assertOk();
    }

    /**
     * @return array<string, mixed>
     */
    private static function validRegistrationPayload(string $email = 'first@example.test'): array
    {
        return [
            'name' => 'First User',
            'email' => $email,
            'password' => self::validPassword(),
            'password_confirmation' => self::validPassword(),
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

    private static function validPassword(): string
    {
        return 'correct-horse-battery-staple';
    }

    /**
     * @return array{Authorization: string}
     */
    private static function bearerHeaders(string $accessToken): array
    {
        return ['Authorization' => 'Bearer '.$accessToken];
    }
}
