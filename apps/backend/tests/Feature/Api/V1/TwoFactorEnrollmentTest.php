<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Models\AuditLog;
use App\Models\RefreshToken;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\InteractsWithAuthApi;
use Tests\TestCase;

final class TwoFactorEnrollmentTest extends TestCase
{
    use InteractsWithAuthApi;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
    }

    public function test_an_access_token_alone_cannot_reset_an_active_factor(): void
    {
        $session = $this->registerWithTwoFactor();

        $this->login()->assertUnprocessable()->assertJsonValidationErrors('two_factor_code');

        $this->postJson('/api/v1/auth/two-factor/enable', [], $this->bearer($session['access_token']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['password', 'code']);

        $this->login()->assertUnprocessable()->assertJsonValidationErrors('two_factor_code');

        $user = User::query()->firstOrFail();
        self::assertNotNull($user->two_fa_enabled_at);
        self::assertSame($session['secret'], $user->two_fa_secret_enc);
        self::assertNull($user->two_fa_pending_secret_enc);
        self::assertTrue(AuditLog::query()->where('action', 'auth.2fa.replace_denied')->exists());
    }

    public function test_replacement_is_rejected_with_a_wrong_password_or_code(): void
    {
        $session = $this->registerWithTwoFactor();
        $headers = $this->bearer($session['access_token']);

        $this->postJson('/api/v1/auth/two-factor/enable', [
            'password' => 'not-the-password',
            'code' => self::totp($session['secret']),
        ], $headers)->assertUnprocessable()->assertJsonValidationErrors('password');

        $this->postJson('/api/v1/auth/two-factor/enable', [
            'password' => self::password(),
            'code' => self::totp($session['secret']) === '000000' ? '111111' : '000000',
        ], $this->bearer($session['access_token']))->assertUnprocessable()->assertJsonValidationErrors('code');

        $user = User::query()->firstOrFail();
        self::assertNotNull($user->two_fa_enabled_at);
        self::assertSame($session['secret'], $user->two_fa_secret_enc);
        self::assertNull($user->two_fa_pending_secret_enc);
        self::assertSame(2, AuditLog::query()->where('action', 'auth.2fa.replace_denied')->count());
    }

    public function test_replacing_the_factor_keeps_the_old_one_until_the_new_one_is_verified(): void
    {
        $session = $this->registerWithTwoFactor();
        $oldSecret = $session['secret'];

        $other = $this->login(extra: ['two_factor_code' => self::totp($oldSecret), 'device_name' => 'Other'])
            ->assertOk();
        $this->nextTotpStep();

        $replace = $this->postJson('/api/v1/auth/two-factor/enable', [
            'password' => self::password(),
            'code' => self::totp($oldSecret),
        ], $this->bearer($session['access_token']))->assertOk()->assertJsonStructure(['secret', 'otpauth_uri']);
        $newSecret = (string) $replace->json('secret');
        self::assertNotSame($oldSecret, $newSecret);
        $this->nextTotpStep();

        // The active factor is untouched while the new one is pending.
        $user = User::query()->firstOrFail();
        self::assertNotNull($user->two_fa_enabled_at);
        self::assertSame($oldSecret, $user->two_fa_secret_enc);
        self::assertSame($newSecret, $user->two_fa_pending_secret_enc);

        $this->login()->assertUnprocessable()->assertJsonValidationErrors('two_factor_code');
        $this->login(extra: ['two_factor_code' => self::totp($newSecret)])->assertUnprocessable();
        $this->login(extra: ['two_factor_code' => self::totp($oldSecret)])->assertOk();
        $this->nextTotpStep();

        $this->postJson('/api/v1/auth/two-factor/verify', [
            'code' => self::totp($newSecret),
        ], $this->bearer($session['access_token']))->assertOk();
        $this->nextTotpStep();

        $user->refresh();
        self::assertSame($newSecret, $user->two_fa_secret_enc);
        self::assertNull($user->two_fa_pending_secret_enc);
        self::assertNotNull($user->two_fa_enabled_at);

        $this->login(extra: ['two_factor_code' => self::totp($oldSecret)])->assertUnprocessable();
        $this->login(extra: ['two_factor_code' => self::totp($newSecret)])->assertOk();

        // Other sessions are revoked once the factor changes; the current one survives.
        $this->getJson('/api/v1/me', $this->bearer((string) $other->json('access_token')))->assertUnauthorized();
        $this->postJson('/api/v1/auth/refresh', ['refresh_token' => (string) $other->json('refresh_token')])
            ->assertUnprocessable();
        $this->getJson('/api/v1/me', $this->bearer($session['access_token']))->assertOk();

        self::assertTrue(AuditLog::query()->where('action', 'auth.2fa.replace_started')->exists());
        self::assertTrue(AuditLog::query()->where('action', 'auth.2fa.replaced')->exists());
        self::assertTrue(
            RefreshToken::query()->where('token_hash', hash('sha256', $session['refresh_token']))->whereNull('revoked_at')->exists(),
        );
    }

    public function test_first_enrollment_does_not_activate_until_verified(): void
    {
        $registration = $this->registerUser()->assertCreated();
        $headers = $this->bearer((string) $registration->json('access_token'));

        $secret = (string) $this->postJson('/api/v1/auth/two-factor/enable', [], $headers)
            ->assertOk()
            ->json('secret');

        $user = User::query()->firstOrFail();
        self::assertNull($user->two_fa_enabled_at);
        self::assertNull($user->two_fa_secret_enc);
        self::assertSame($secret, $user->two_fa_pending_secret_enc);

        $this->login()->assertOk();

        $this->postJson('/api/v1/auth/two-factor/verify', ['code' => self::totp($secret)], $this->bearer((string) $registration->json('access_token')))
            ->assertOk();

        $user->refresh();
        self::assertNotNull($user->two_fa_enabled_at);
        self::assertSame($secret, $user->two_fa_secret_enc);
        self::assertNull($user->two_fa_pending_secret_enc);
        self::assertTrue(AuditLog::query()->where('action', 'auth.2fa.enabled')->exists());
    }

    public function test_pending_secret_is_encrypted_at_rest_and_hidden(): void
    {
        $registration = $this->registerUser()->assertCreated();
        $headers = $this->bearer((string) $registration->json('access_token'));

        $secret = (string) $this->postJson('/api/v1/auth/two-factor/enable', [], $headers)->json('secret');

        $raw = (string) DB::table('users')->value('two_fa_pending_secret_enc');
        self::assertNotSame($secret, $raw);
        self::assertSame($secret, Crypt::decryptString($raw));

        $me = $this->getJson('/api/v1/me', $this->bearer((string) $registration->json('access_token')))->assertOk();
        self::assertStringNotContainsString($secret, (string) $me->getContent());
        self::assertArrayNotHasKey('two_fa_pending_secret_enc', User::query()->firstOrFail()->toArray());
    }

    public function test_verify_without_a_pending_enrollment_is_rejected(): void
    {
        $session = $this->registerWithTwoFactor();

        $this->postJson('/api/v1/auth/two-factor/verify', [
            'code' => self::totp($session['secret']),
        ], $this->bearer($session['access_token']))->assertUnprocessable()->assertJsonValidationErrors('code');
    }

    public function test_disable_requires_password_and_current_code(): void
    {
        $session = $this->registerWithTwoFactor();

        $this->postJson('/api/v1/auth/two-factor/disable', [], $this->bearer($session['access_token']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['password', 'code']);

        $this->postJson('/api/v1/auth/two-factor/disable', [
            'password' => 'not-the-password',
            'code' => self::totp($session['secret']),
        ], $this->bearer($session['access_token']))->assertUnprocessable()->assertJsonValidationErrors('password');

        self::assertNotNull(User::query()->firstOrFail()->two_fa_enabled_at);
        self::assertTrue(AuditLog::query()->where('action', 'auth.2fa.disable_denied')->exists());

        $this->postJson('/api/v1/auth/two-factor/disable', [
            'password' => self::password(),
            'code' => self::totp($session['secret']),
        ], $this->bearer($session['access_token']))->assertOk();

        $user = User::query()->firstOrFail();
        self::assertNull($user->two_fa_enabled_at);
        self::assertNull($user->two_fa_secret_enc);
        self::assertNull($user->two_fa_pending_secret_enc);
    }

    public function test_audit_entries_never_contain_the_secret(): void
    {
        $session = $this->registerWithTwoFactor();

        $this->postJson('/api/v1/auth/two-factor/enable', [
            'password' => self::password(),
            'code' => self::totp($session['secret']),
        ], $this->bearer($session['access_token']))->assertOk();

        $serialised = AuditLog::query()->get()->toJson();
        self::assertStringNotContainsString($session['secret'], $serialised);
        self::assertStringNotContainsString(self::password(), $serialised);
    }
}
