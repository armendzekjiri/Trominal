<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Models\AppSetting;
use App\Models\AuditLog;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\JsonResponse;
use Illuminate\Testing\TestResponse;
use Tests\Concerns\InteractsWithAuthApi;
use Tests\TestCase;

final class AuthRateLimitTest extends TestCase
{
    use InteractsWithAuthApi;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
    }

    public function test_failed_logins_lock_the_account_even_across_ip_addresses(): void
    {
        $this->openRegistration();
        $this->registerUser()->assertCreated();
        $this->registerUser('other@example.test')->assertCreated();

        foreach (range(1, 5) as $attempt) {
            $this->loginFrom("203.0.113.{$attempt}", password: 'wrong-password')->assertUnprocessable();
        }

        $this->loginFrom('198.51.100.7')->assertTooManyRequests()->assertHeader('Retry-After');
        $this->loginFrom('198.51.100.8', 'other@example.test')->assertOk();

        $this->travel(16)->minutes();

        $this->loginFrom('198.51.100.7')->assertOk();
    }

    public function test_failed_logins_lock_the_ip_address_across_accounts(): void
    {
        $this->registerUser()->assertCreated();

        foreach (range(1, 5) as $attempt) {
            $this->loginFrom('203.0.113.10', "unknown-{$attempt}@example.test")->assertUnprocessable();
        }

        $this->loginFrom('203.0.113.10')->assertTooManyRequests();
        $this->loginFrom('203.0.113.11')->assertOk();
    }

    public function test_a_successful_login_clears_the_account_failure_counter(): void
    {
        $this->registerUser()->assertCreated();

        foreach (range(1, 4) as $attempt) {
            $this->loginFrom("203.0.113.{$attempt}", password: 'wrong-password')->assertUnprocessable();
        }

        $this->loginFrom('198.51.100.1')->assertOk();

        foreach (range(5, 8) as $attempt) {
            $this->loginFrom("203.0.113.{$attempt}", password: 'wrong-password')->assertUnprocessable();
        }

        $this->loginFrom('198.51.100.2')->assertOk();
    }

    public function test_wrong_login_totp_codes_are_bounded(): void
    {
        $session = $this->registerWithTwoFactor();
        $wrong = self::wrongCode($session['secret']);

        foreach (range(1, 5) as $attempt) {
            $this->loginFrom("203.0.113.{$attempt}", extra: ['two_factor_code' => $wrong])->assertUnprocessable();
        }

        $this->loginFrom('198.51.100.3', extra: ['two_factor_code' => self::totp($session['secret'])])
            ->assertTooManyRequests();
    }

    public function test_a_totp_code_cannot_be_replayed(): void
    {
        $session = $this->registerWithTwoFactor();
        $code = self::totp($session['secret']);

        $this->login(extra: ['two_factor_code' => $code])->assertOk();
        $this->login(extra: ['two_factor_code' => $code])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('two_factor_code');

        // Nor can a code from an earlier step inside the drift window.
        $this->login(extra: ['two_factor_code' => self::totp($session['secret'], -1)])->assertUnprocessable();

        $this->nextTotpStep();
        $this->login(extra: ['two_factor_code' => self::totp($session['secret'])])->assertOk();
    }

    public function test_a_login_code_cannot_be_reused_for_step_up(): void
    {
        $session = $this->registerWithTwoFactor();
        $code = self::totp($session['secret']);

        $this->login(extra: ['two_factor_code' => $code])->assertOk();

        $this->postJson('/api/v1/auth/two-factor/disable', [
            'password' => self::password(),
            'code' => $code,
        ], $this->bearer($session['access_token']))->assertUnprocessable()->assertJsonValidationErrors('code');
    }

    public function test_the_enrollment_code_cannot_be_reused_to_sign_in(): void
    {
        $registration = $this->registerUser()->assertCreated();
        $secret = (string) $this->postJson('/api/v1/auth/two-factor/enable', [], $this->bearer((string) $registration->json('access_token')))
            ->json('secret');
        $code = self::totp($secret);

        $this->postJson('/api/v1/auth/two-factor/verify', ['code' => $code], $this->bearer((string) $registration->json('access_token')))
            ->assertOk();

        $this->login(extra: ['two_factor_code' => $code])->assertUnprocessable();
    }

    public function test_authenticated_two_factor_attempts_are_bounded(): void
    {
        $session = $this->registerWithTwoFactor();
        $wrong = self::wrongCode($session['secret']);

        $statuses = [];
        foreach (range(1, 6) as $attempt) {
            $statuses[] = $this->postJson('/api/v1/auth/two-factor/disable', [
                'password' => self::password(),
                'code' => $wrong,
            ], $this->bearer($session['access_token']))->status();
        }

        self::assertSame([422, 422, 422, 422, 422, 429], $statuses);

        $this->postJson('/api/v1/auth/two-factor/disable', [
            'password' => self::password(),
            'code' => self::totp($session['secret']),
        ], $this->bearer($session['access_token']))->assertTooManyRequests();
    }

    public function test_wrong_passwords_during_step_up_are_bounded(): void
    {
        $session = $this->registerWithTwoFactor();

        foreach (range(1, 5) as $attempt) {
            $this->postJson('/api/v1/auth/two-factor/enable', [
                'password' => "wrong-password-{$attempt}",
                'code' => self::totp($session['secret']),
            ], $this->bearer($session['access_token']))->assertUnprocessable();
        }

        $this->postJson('/api/v1/auth/two-factor/enable', [
            'password' => self::password(),
            'code' => self::totp($session['secret']),
        ], $this->bearer($session['access_token']))->assertTooManyRequests();
    }

    public function test_two_factor_routes_have_a_request_throttle(): void
    {
        $registration = $this->registerUser()->assertCreated();
        $token = (string) $registration->json('access_token');

        $statuses = [];
        foreach (range(1, 11) as $attempt) {
            $statuses[] = $this->postJson('/api/v1/auth/two-factor/enable', [], $this->bearer($token))->status();
        }

        self::assertSame(200, $statuses[0]);
        self::assertSame(429, $statuses[10]);
    }

    public function test_refresh_is_throttled_per_ip_and_per_account(): void
    {
        $registration = $this->registerUser()->assertCreated();
        $refreshToken = (string) $registration->json('refresh_token');

        // Per account: rotating from many addresses is still bounded.
        $statuses = [];
        foreach (range(1, 11) as $attempt) {
            $response = $this->withServerVariables(['REMOTE_ADDR' => "203.0.113.{$attempt}"])
                ->postJson('/api/v1/auth/refresh', ['refresh_token' => $refreshToken]);
            $statuses[] = $response->status();

            if ($response->status() === 200) {
                $refreshToken = (string) $response->json('refresh_token');
            }
        }

        self::assertSame(array_fill(0, 10, 200), array_slice($statuses, 0, 10));
        self::assertSame(429, $statuses[10]);

        // Per IP: unknown tokens from one address are bounded too.
        $statuses = [];
        foreach (range(1, 11) as $attempt) {
            $statuses[] = $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.20'])
                ->postJson('/api/v1/auth/refresh', ['refresh_token' => str_repeat((string) ($attempt % 10), 128)])
                ->status();
        }

        self::assertSame(429, $statuses[10]);
    }

    public function test_lockouts_are_audited_without_the_email_address(): void
    {
        $this->registerUser()->assertCreated();

        foreach (range(1, 6) as $attempt) {
            $this->loginFrom("203.0.113.{$attempt}", password: 'wrong-password');
        }

        /** @var AuditLog $log */
        $log = AuditLog::query()->where('action', 'auth.login.throttled')->firstOrFail();
        self::assertStringNotContainsString('first@example.test', (string) json_encode($log->metadata));
    }

    /**
     * @param  array<string, mixed>  $extra
     * @return TestResponse<JsonResponse>
     */
    private function loginFrom(string $ip, string $email = 'first@example.test', ?string $password = null, array $extra = []): TestResponse
    {
        return $this->withServerVariables(['REMOTE_ADDR' => $ip])->login($email, $password, $extra);
    }

    private function openRegistration(): void
    {
        AppSetting::registration()->update([
            'value' => [
                'mode' => 'open',
                'open' => true,
                'instance_name' => 'Trominal',
                'web_ssh_enabled' => false,
            ],
        ]);
    }

    private static function wrongCode(string $secret): string
    {
        $valid = [self::totp($secret, -1), self::totp($secret), self::totp($secret, 1)];

        foreach (['000000', '111111', '222222', '333333'] as $candidate) {
            if (! in_array($candidate, $valid, true)) {
                return $candidate;
            }
        }

        return '444444';
    }
}
