<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Models\AuditLog;
use App\Models\Group;
use App\Models\Host;
use App\Models\RefreshToken;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

final class VaultTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
    }

    public function test_manages_encrypted_host_records_and_keeps_database_ciphertext_wrapped(): void
    {
        $user = $this->userWithRole('user');
        $headers = $this->bearerHeaders($user);

        $payload = self::hostPayload();
        $create = $this->postJson('/api/v1/vault/hosts', $payload, $headers);

        $create
            ->assertCreated()
            ->assertJsonPath('data.type', 'hosts')
            ->assertJsonPath('data.name_ciphertext', $payload['name_ciphertext'])
            ->assertJsonPath('data.hostname_ciphertext', $payload['hostname_ciphertext']);

        $hostId = (string) $create->json('data.id');
        $rawCiphertext = DB::table('hosts')->where('id', $hostId)->value('name_ciphertext');

        self::assertIsString($rawCiphertext);
        self::assertNotSame($payload['name_ciphertext'], $rawCiphertext);

        $this->getJson("/api/v1/vault/hosts/{$hostId}", $headers)
            ->assertOk()
            ->assertJsonPath('data.id', $hostId)
            ->assertJsonPath('data.name_ciphertext', $payload['name_ciphertext']);

        $this->patchJson("/api/v1/vault/hosts/{$hostId}", [
            'username_ciphertext' => 'updated-user-ciphertext',
            'username_nonce' => 'updated-user-nonce',
        ], $headers)
            ->assertOk()
            ->assertJsonPath('data.username_ciphertext', 'updated-user-ciphertext');

        $this->getJson('/api/v1/vault/hosts', $headers)
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->deleteJson("/api/v1/vault/hosts/{$hostId}", [], $headers)
            ->assertNoContent();

        $this->assertSoftDeleted('hosts', ['id' => $hostId]);
        self::assertSame(1, AuditLog::query()->where('action', 'vault.hosts.created')->count());
        self::assertSame(1, AuditLog::query()->where('action', 'vault.hosts.updated')->count());
        self::assertSame(1, AuditLog::query()->where('action', 'vault.hosts.deleted')->count());
    }

    public function test_rejects_vault_writes_without_required_spatie_permission(): void
    {
        $user = User::factory()->create();
        $headers = $this->bearerHeaders($user);

        $this->postJson('/api/v1/vault/hosts', self::hostPayload(), $headers)
            ->assertForbidden();
    }

    public function test_enforces_vault_record_ownership(): void
    {
        $owner = $this->userWithRole('user');
        $otherUser = $this->userWithRole('user');
        $host = $this->createHost($owner);
        $headers = $this->bearerHeaders($otherUser);

        $this->getJson("/api/v1/vault/hosts/{$host->id}", $headers)
            ->assertForbidden();

        $this->patchJson("/api/v1/vault/hosts/{$host->id}", [
            'name_ciphertext' => 'other-name-ciphertext',
            'name_nonce' => 'other-name-nonce',
        ], $headers)->assertForbidden();

        $this->deleteJson("/api/v1/vault/hosts/{$host->id}", [], $headers)
            ->assertForbidden();
    }

    public function test_validates_relationships_belong_to_the_authenticated_user(): void
    {
        $user = $this->userWithRole('user');
        $otherUser = $this->userWithRole('user');
        $otherGroup = Group::query()->create([
            'user_id' => $otherUser->id,
            'name_ciphertext' => 'other-group-ciphertext',
            'name_nonce' => 'other-group-nonce',
        ]);
        $headers = $this->bearerHeaders($user);

        $this->postJson('/api/v1/vault/hosts', [
            ...self::hostPayload(),
            'group_id' => $otherGroup->id,
        ], $headers)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['group_id']);
    }

    public function test_delta_sync_returns_updates_and_soft_delete_tombstones(): void
    {
        $user = $this->userWithRole('user');
        $host = $this->createHost($user);
        $cursor = now()->subMinute()->toIso8601String();
        $headers = $this->bearerHeaders($user);

        $sync = $this->getJson('/api/v1/vault/sync?cursor='.rawurlencode($cursor), $headers);

        $sync
            ->assertOk()
            ->assertJsonPath('vault_version', 1)
            ->assertJsonPath('data.hosts.0.id', $host->id)
            ->assertJsonPath('data.hosts.0.deleted_at', null);

        $this->deleteJson("/api/v1/vault/hosts/{$host->id}", [], $headers)
            ->assertNoContent();

        $tombstone = $this->getJson('/api/v1/vault/sync?cursor='.rawurlencode($cursor), $headers);

        $tombstone
            ->assertOk()
            ->assertJsonPath('data.hosts.0.id', $host->id);

        self::assertNotNull($tombstone->json('data.hosts.0.deleted_at'));
    }

    public function test_master_password_change_reencrypts_records_bumps_vault_version_and_revokes_other_sessions(): void
    {
        $user = $this->userWithRole('user');
        $host = $this->createHost($user);
        $keepToken = 'keep-refresh-token';

        RefreshToken::query()->create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $keepToken),
            'expires_at' => now()->addDay(),
        ]);
        RefreshToken::query()->create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', 'revoke-refresh-token'),
            'expires_at' => now()->addDay(),
        ]);
        $headers = $this->bearerHeaders($user);

        $this->postJson('/api/v1/me/master-password/change', [
            'new_kdf_salt' => base64_encode(str_repeat('r', 16)),
            'new_kdf_params' => [
                'version' => 2,
                'alg' => 'argon2id',
                'memlimit' => 134217728,
                'opslimit' => 4,
            ],
            'current_refresh_token' => $keepToken,
            'items' => [
                [
                    'type' => 'hosts',
                    'id' => $host->id,
                    'fields' => [
                        'name_ciphertext' => 'rotated-name-ciphertext',
                        'name_nonce' => 'rotated-name-nonce',
                        'hostname_ciphertext' => 'rotated-hostname-ciphertext',
                        'hostname_nonce' => 'rotated-hostname-nonce',
                    ],
                ],
            ],
        ], $headers)
            ->assertOk()
            ->assertJsonPath('vault_version', 2);

        $user->refresh();
        $host->refresh();

        self::assertSame(2, $user->vault_version);
        self::assertSame('rotated-name-ciphertext', $host->name_ciphertext);
        self::assertSame('rotated-hostname-ciphertext', $host->hostname_ciphertext);
        self::assertNull(RefreshToken::query()->where('token_hash', hash('sha256', $keepToken))->value('revoked_at'));
        self::assertNotNull(RefreshToken::query()->where('token_hash', hash('sha256', 'revoke-refresh-token'))->value('revoked_at'));
        self::assertTrue(AuditLog::query()->where('action', 'vault.master_password.changed')->exists());
    }

    public function test_master_password_change_rejects_non_reencryption_fields_and_rolls_back(): void
    {
        $user = $this->userWithRole('user');
        $host = $this->createHost($user);
        $headers = $this->bearerHeaders($user);

        $this->postJson('/api/v1/me/master-password/change', [
            'new_kdf_salt' => base64_encode(str_repeat('r', 16)),
            'new_kdf_params' => ['version' => 2, 'alg' => 'argon2id'],
            'current_refresh_token' => 'current-refresh-token',
            'items' => [
                [
                    'type' => 'hosts',
                    'id' => $host->id,
                    'fields' => [
                        'group_id' => null,
                    ],
                ],
            ],
        ], $headers)->assertUnprocessable();

        $user->refresh();
        $host->refresh();

        self::assertSame(1, $user->vault_version);
        self::assertSame('host-name-ciphertext', $host->name_ciphertext);
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    /**
     * @return array<string, string>
     */
    private static function hostPayload(): array
    {
        return [
            'name_ciphertext' => 'host-name-ciphertext',
            'name_nonce' => 'host-name-nonce',
            'hostname_ciphertext' => 'host-address-ciphertext',
            'hostname_nonce' => 'host-address-nonce',
        ];
    }

    private function createHost(User $user): Host
    {
        /** @var Host $host */
        $host = Host::query()->create([
            'user_id' => $user->id,
            ...self::hostPayload(),
        ]);

        return $host;
    }

    /**
     * @return array{Authorization: string}
     */
    private function bearerHeaders(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('Vault feature test')->plainTextToken];
    }
}
