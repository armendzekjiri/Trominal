<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Models\AppSetting;
use App\Models\AuditLog;
use App\Models\Host;
use App\Models\User;
use App\Models\WsSessionToken;
use App\Services\Ssh\SshTokenVerifier;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class SshTokenTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
        $this->enableWebSsh();
    }

    public function test_creates_short_lived_ip_bound_web_ssh_tokens_for_owned_hosts(): void
    {
        $user = $this->userWithRole('user');
        $host = $this->createHost($user);

        $response = $this->postJson('/api/v1/ws/ssh-token', [
            'host_id' => $host->id,
        ], $this->bearerHeaders($user));

        $response
            ->assertCreated()
            ->assertJsonStructure(['token', 'expires_at', 'websocket_url']);

        $plainToken = (string) $response->json('token');
        $record = WsSessionToken::query()->where('host_id', $host->id)->firstOrFail();

        self::assertSame(64, strlen($plainToken));
        self::assertSame(hash('sha256', $plainToken), $record->token_hash);
        self::assertNotSame($plainToken, $record->token_hash);
        self::assertSame('127.0.0.1', $record->ip_address);
        self::assertNotNull($record->expires_at);
        self::assertTrue($record->expires_at->isFuture());
        self::assertStringContainsString('/ws/ssh?token=', (string) $response->json('websocket_url'));
        self::assertTrue(AuditLog::query()->where('action', 'ssh.token.created')->exists());
    }

    public function test_ssh_tokens_are_single_use_and_ip_bound(): void
    {
        $user = $this->userWithRole('user');
        $host = $this->createHost($user);
        $response = $this->postJson('/api/v1/ws/ssh-token', [
            'host_id' => $host->id,
        ], $this->bearerHeaders($user));
        $plainToken = (string) $response->json('token');
        $verifier = app(SshTokenVerifier::class);

        $token = $verifier->consume($plainToken, '127.0.0.1');

        self::assertNotNull($token->consumed_at);

        $this->expectExceptionMessage('The SSH session token is invalid or expired.');

        $verifier->consume($plainToken, '127.0.0.1');
    }

    public function test_ssh_token_uses_configured_proxy_url_when_present(): void
    {
        config(['trominal.web_ssh_proxy_url' => 'wss://ssh.example.test/ws/ssh']);

        $user = $this->userWithRole('user');
        $host = $this->createHost($user);

        $response = $this->postJson('/api/v1/ws/ssh-token', [
            'host_id' => $host->id,
        ], $this->bearerHeaders($user));

        self::assertStringStartsWith(
            'wss://ssh.example.test/ws/ssh?token=',
            (string) $response->json('websocket_url'),
        );
    }

    public function test_ssh_tokens_reject_ip_mismatches(): void
    {
        $user = $this->userWithRole('user');
        $host = $this->createHost($user);
        $response = $this->postJson('/api/v1/ws/ssh-token', [
            'host_id' => $host->id,
        ], $this->bearerHeaders($user));

        $this->expectExceptionMessage('The SSH session token is invalid or expired.');

        app(SshTokenVerifier::class)->consume((string) $response->json('token'), '192.0.2.10');
    }

    public function test_rejects_web_ssh_tokens_for_unowned_hosts(): void
    {
        $user = $this->userWithRole('user');
        $otherUser = $this->userWithRole('user');
        $host = $this->createHost($otherUser);

        $this->postJson('/api/v1/ws/ssh-token', [
            'host_id' => $host->id,
        ], $this->bearerHeaders($user))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['host_id']);
    }

    public function test_rejects_web_ssh_tokens_without_connect_permission(): void
    {
        $user = User::factory()->create();
        $host = $this->createHost($this->userWithRole('user'));

        $this->postJson('/api/v1/ws/ssh-token', [
            'host_id' => $host->id,
        ], $this->bearerHeaders($user))
            ->assertForbidden();
    }

    public function test_rejects_web_ssh_tokens_when_web_ssh_is_disabled(): void
    {
        $user = $this->userWithRole('user');
        $host = $this->createHost($user);

        AppSetting::registration()->update([
            'value' => [
                'mode' => 'single',
                'open' => false,
                'instance_name' => 'Trominal',
                'web_ssh_enabled' => false,
            ],
        ]);

        $this->postJson('/api/v1/ws/ssh-token', [
            'host_id' => $host->id,
        ], $this->bearerHeaders($user))
            ->assertForbidden();
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    private function enableWebSsh(): void
    {
        AppSetting::registration()->update([
            'value' => [
                'mode' => 'single',
                'open' => false,
                'instance_name' => 'Trominal',
                'web_ssh_enabled' => true,
            ],
        ]);
    }

    private function createHost(User $user): Host
    {
        /** @var Host $host */
        $host = Host::query()->create([
            'user_id' => $user->id,
            'name_ciphertext' => 'host-name-ciphertext',
            'name_nonce' => 'host-name-nonce',
            'hostname_ciphertext' => 'host-address-ciphertext',
            'hostname_nonce' => 'host-address-nonce',
        ]);

        return $host;
    }

    /**
     * @return array{Authorization: string}
     */
    private function bearerHeaders(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('SSH token feature test')->plainTextToken];
    }
}
