<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Models\AuditLog;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithAuthApi;
use Tests\TestCase;

final class AccountStateDisclosureTest extends TestCase
{
    use InteractsWithAuthApi;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
    }

    public function test_a_suspended_account_is_indistinguishable_from_wrong_credentials(): void
    {
        $this->registerUser()->assertCreated();

        $wrongPassword = $this->login(password: 'not-the-password')->assertUnprocessable();

        User::query()->firstOrFail()->forceFill(['suspended_at' => now()])->save();

        $suspended = $this->login()->assertUnprocessable();

        self::assertSame($wrongPassword->json(), $suspended->json());
        self::assertStringNotContainsStringIgnoringCase('suspend', (string) $suspended->getContent());
        self::assertTrue(AuditLog::query()->where('action', 'auth.login.blocked_suspended')->exists());
    }

    public function test_a_suspended_account_with_two_factor_does_not_reveal_the_second_step(): void
    {
        $session = $this->registerWithTwoFactor();

        $wrongPassword = $this->login(password: 'not-the-password')->assertUnprocessable();

        User::query()->firstOrFail()->forceFill(['suspended_at' => now()])->save();

        $withoutCode = $this->login()->assertUnprocessable();
        $withCode = $this->login(extra: ['two_factor_code' => self::totp($session['secret'])])->assertUnprocessable();

        self::assertSame($wrongPassword->json(), $withoutCode->json());
        self::assertSame($wrongPassword->json(), $withCode->json());
    }

    public function test_suspended_sign_in_attempts_count_towards_the_lockout(): void
    {
        $this->registerUser()->assertCreated();
        User::query()->firstOrFail()->forceFill(['suspended_at' => now()])->save();

        foreach (range(1, 5) as $attempt) {
            $this->withServerVariables(['REMOTE_ADDR' => "203.0.113.{$attempt}"])->login()->assertUnprocessable();
        }

        $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.1'])->login()->assertTooManyRequests();
    }
}
