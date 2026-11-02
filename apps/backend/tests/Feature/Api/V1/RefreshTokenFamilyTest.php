<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Models\AuditLog;
use App\Models\Device;
use App\Models\PersonalAccessToken;
use App\Models\RefreshToken;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\Concerns\InteractsWithAuthApi;
use Tests\TestCase;

final class RefreshTokenFamilyTest extends TestCase
{
    use InteractsWithAuthApi;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
    }

    public function test_replaying_a_rotated_token_revokes_its_live_successor(): void
    {
        $registration = $this->registerUser()->assertCreated();
        $original = (string) $registration->json('refresh_token');

        $rotated = $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $original])->assertOk();

        $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $original])->assertUnprocessable();

        $this->postJson('/api/v1/auth/refresh', ['refresh_token' => (string) $rotated->json('refresh_token')])
            ->assertUnprocessable();

        // Access tokens minted for the compromised device are revoked as well.
        $this->getJson('/api/v1/me', $this->bearer((string) $rotated->json('access_token')))->assertUnauthorized();
        $this->getJson('/api/v1/me', $this->bearer((string) $registration->json('access_token')))->assertUnauthorized();

        self::assertSame(0, RefreshToken::query()->whereNull('revoked_at')->count());

        /** @var AuditLog $log */
        $log = AuditLog::query()->where('action', 'auth.token.reuse_detected')->firstOrFail();
        self::assertIsArray($log->metadata);
        self::assertArrayHasKey('family_id', $log->metadata);
        self::assertArrayHasKey('device_id', $log->metadata);
    }

    public function test_rotation_keeps_a_stable_device_and_family(): void
    {
        $registration = $this->registerUser()->assertCreated();

        $first = $this->postJson('/api/v1/auth/refresh', [
            'refresh_token' => (string) $registration->json('refresh_token'),
        ])->assertOk();
        $this->postJson('/api/v1/auth/refresh', [
            'refresh_token' => (string) $first->json('refresh_token'),
        ])->assertOk();

        self::assertSame(1, Device::query()->count());
        self::assertSame(3, RefreshToken::query()->count());
        self::assertSame(1, RefreshToken::query()->distinct()->count('family_id'));
        self::assertSame(1, RefreshToken::query()->distinct()->count('device_id'));

        $deviceId = (string) Device::query()->value('id');
        self::assertSame(3, PersonalAccessToken::query()->where('device_id', $deviceId)->count());
    }

    public function test_replay_on_one_device_does_not_sign_out_other_devices(): void
    {
        $registration = $this->registerUser()->assertCreated();
        $laptop = $this->login(extra: ['device_name' => 'Laptop'])->assertOk();

        $original = (string) $registration->json('refresh_token');
        $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $original])->assertOk();
        $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $original])->assertUnprocessable();

        $this->getJson('/api/v1/me', $this->bearer((string) $laptop->json('access_token')))->assertOk();
        $this->postJson('/api/v1/auth/refresh', ['refresh_token' => (string) $laptop->json('refresh_token')])
            ->assertOk();
    }

    public function test_refresh_tokens_default_to_seven_days(): void
    {
        $this->registerUser()->assertCreated();

        /** @var RefreshToken $token */
        $token = RefreshToken::query()->firstOrFail();
        self::assertNotNull($token->expires_at);
        self::assertEqualsWithDelta(now()->addDays(7)->getTimestamp(), $token->expires_at->getTimestamp(), 5);
    }

    public function test_configured_refresh_lifetime_is_bounded(): void
    {
        config(['trominal.refresh_token_expiration_days' => 365]);
        $this->registerUser()->assertCreated();

        config(['trominal.refresh_token_expiration_days' => 0]);
        $this->login()->assertOk();

        $expiries = RefreshToken::query()->orderBy('created_at')->orderBy('id')->pluck('expires_at')
            ->map(fn ($value): int => (int) Carbon::parse($value)->getTimestamp())
            ->sort()
            ->values();

        self::assertEqualsWithDelta(now()->addDay()->getTimestamp(), $expiries[0], 5);
        self::assertEqualsWithDelta(now()->addDays(30)->getTimestamp(), $expiries[1], 5);
    }

    public function test_expired_and_unknown_refresh_tokens_are_rejected(): void
    {
        $registration = $this->registerUser()->assertCreated();

        $this->postJson('/api/v1/auth/refresh', ['refresh_token' => str_repeat('a', 128)])->assertUnprocessable();

        $this->travel(8)->days();

        $this->postJson('/api/v1/auth/refresh', ['refresh_token' => (string) $registration->json('refresh_token')])
            ->assertUnprocessable();
    }
}
