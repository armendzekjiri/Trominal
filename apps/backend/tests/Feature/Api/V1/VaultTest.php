<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Models\AuditLog;
use App\Models\Group;
use App\Models\Host;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Auth\AuthManager;
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

    public function test_stores_encrypted_host_key_pins_and_keeps_them_on_partial_updates(): void
    {
        $user = $this->userWithRole('user');
        $headers = $this->bearerHeaders($user);
        $hostId = '01JZ0000000000000000000001';

        // Existing clients create hosts without pins.
        $this->postJson('/api/v1/vault/hosts', [
            'id' => $hostId,
            ...self::hostPayload(),
        ], $headers)
            ->assertCreated()
            ->assertJsonPath('data.host_keys_ciphertext', null);

        $this->patchJson("/api/v1/vault/hosts/{$hostId}", [
            'host_keys_ciphertext' => 'pinned-keys-ciphertext',
            'host_keys_nonce' => 'pinned-keys-nonce',
        ], $headers)
            ->assertOk()
            ->assertJsonPath('data.host_keys_ciphertext', 'pinned-keys-ciphertext')
            ->assertJsonPath('data.host_keys_nonce', 'pinned-keys-nonce');

        $raw = DB::table('hosts')->where('id', $hostId)->value('host_keys_ciphertext');
        self::assertIsString($raw);
        self::assertNotSame('pinned-keys-ciphertext', $raw);

        // An update that doesn't mention the pins leaves them alone.
        $this->patchJson("/api/v1/vault/hosts/{$hostId}", [
            'username_ciphertext' => 'updated-user-ciphertext',
            'username_nonce' => 'updated-user-nonce',
        ], $headers)
            ->assertOk()
            ->assertJsonPath('data.host_keys_ciphertext', 'pinned-keys-ciphertext');
    }

    public function test_manages_encrypted_host_records_and_keeps_database_ciphertext_wrapped(): void
    {
        $user = $this->userWithRole('user');
        $headers = $this->bearerHeaders($user);

        $payload = self::hostPayload();
        $hostId = '01JZ0000000000000000000000';
        $create = $this->postJson('/api/v1/vault/hosts', [
            'id' => $hostId,
            ...$payload,
        ], $headers);

        $create
            ->assertCreated()
            ->assertJsonPath('data.id', $hostId)
            ->assertJsonPath('data.type', 'hosts')
            ->assertJsonPath('data.name_ciphertext', $payload['name_ciphertext'])
            ->assertJsonPath('data.hostname_ciphertext', $payload['hostname_ciphertext']);

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

    public function test_team_scoped_vault_records_are_visible_to_team_members_only(): void
    {
        $owner = $this->userWithRole('user');
        $member = $this->userWithRole('user');
        $outsider = $this->userWithRole('user');
        $team = $this->createTeam($owner);
        $this->createMembership($team, $member, TeamMember::ROLE_MEMBER);
        $headers = $this->bearerHeaders($owner);

        $create = $this->postJson('/api/v1/vault/snippets', [
            'id' => '01JZ2000000000000000000000',
            'team_id' => $team->id,
            'team_key_version' => 1,
            ...self::snippetPayload(),
        ], $headers);

        $create
            ->assertCreated()
            ->assertJsonPath('data.team_id', $team->id)
            ->assertJsonPath('data.title_ciphertext', 'snippet-title-ciphertext');

        $this->getJson('/api/v1/vault/snippets', $headers)
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->getJson("/api/v1/vault/snippets?team={$team->id}", $this->bearerHeaders($member))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', '01JZ2000000000000000000000');

        $this->getJson('/api/v1/vault/snippets/01JZ2000000000000000000000', $this->bearerHeaders($member))
            ->assertOk()
            ->assertJsonPath('data.team_id', $team->id);

        $this->getJson("/api/v1/vault/snippets?team={$team->id}", $this->bearerHeaders($outsider))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['team_id']);

        $this->getJson('/api/v1/vault/snippets/01JZ2000000000000000000000', $this->bearerHeaders($outsider))
            ->assertForbidden();
    }

    public function test_team_scoped_vault_relationships_must_stay_inside_the_same_scope(): void
    {
        $owner = $this->userWithRole('user');
        $team = $this->createTeam($owner);
        $personalGroup = Group::query()->create([
            'user_id' => $owner->id,
            'name_ciphertext' => 'personal-group-ciphertext',
            'name_nonce' => 'personal-group-nonce',
        ]);
        $teamGroup = Group::query()->create([
            'user_id' => $owner->id,
            'team_id' => $team->id,
            'name_ciphertext' => 'team-group-ciphertext',
            'name_nonce' => 'team-group-nonce',
        ]);
        $headers = $this->bearerHeaders($owner);

        $this->postJson('/api/v1/vault/hosts', [
            'team_id' => $team->id,
            'team_key_version' => 1,
            'group_id' => $personalGroup->id,
            ...self::hostPayload(),
        ], $headers)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['group_id']);

        $this->postJson('/api/v1/vault/hosts', [
            'group_id' => $teamGroup->id,
            ...self::hostPayload(),
        ], $headers)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['group_id']);

        $this->postJson('/api/v1/vault/hosts', [
            'team_id' => $team->id,
            'team_key_version' => 1,
            'group_id' => $teamGroup->id,
            ...self::hostPayload(),
        ], $headers)
            ->assertCreated()
            ->assertJsonPath('data.team_id', $team->id)
            ->assertJsonPath('data.group_id', $teamGroup->id);
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

    public function test_delta_sync_includes_team_scoped_records_for_team_members(): void
    {
        $owner = $this->userWithRole('user');
        $member = $this->userWithRole('user');
        $outsider = $this->userWithRole('user');
        $team = $this->createTeam($owner);
        $this->createMembership($team, $member, TeamMember::ROLE_MEMBER);
        $host = $this->createHost($owner, team: $team);
        $cursor = now()->subMinute()->toIso8601String();

        $this->getJson('/api/v1/vault/sync?cursor='.rawurlencode($cursor), $this->bearerHeaders($member))
            ->assertOk()
            ->assertJsonPath('data.hosts.0.id', $host->id)
            ->assertJsonPath('data.hosts.0.team_id', $team->id);

        $this->getJson('/api/v1/vault/sync?cursor='.rawurlencode($cursor), $this->bearerHeaders($outsider))
            ->assertOk()
            ->assertJsonMissingPath('data.hosts.0');
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

    /**
     * @return array<string, string>
     */
    private static function snippetPayload(): array
    {
        return [
            'title_ciphertext' => 'snippet-title-ciphertext',
            'title_nonce' => 'snippet-title-nonce',
            'body_ciphertext' => 'snippet-body-ciphertext',
            'body_nonce' => 'snippet-body-nonce',
        ];
    }

    private function createHost(User $user, ?Team $team = null): Host
    {
        /** @var Host $host */
        $host = Host::query()->create([
            'user_id' => $user->id,
            'team_id' => $team?->id,
            ...self::hostPayload(),
        ]);

        return $host;
    }

    private function createTeam(User $owner): Team
    {
        /** @var Team $team */
        $team = Team::query()->create([
            'created_by_user_id' => $owner->id,
            'name_ciphertext' => 'team-name-ciphertext',
            'name_nonce' => 'team-name-nonce',
            'key_version' => 1,
        ]);

        $this->createMembership($team, $owner, TeamMember::ROLE_OWNER);

        return $team;
    }

    private function createMembership(Team $team, User $user, string $role): TeamMember
    {
        /** @var TeamMember $member */
        $member = TeamMember::query()->create([
            'team_id' => $team->id,
            'user_id' => $user->id,
            'role' => $role,
            'wrapped_team_key_ciphertext' => "wrapped-key-{$role}-{$user->id}",
            'wrapped_team_key_nonce' => "wrapped-nonce-{$role}-{$user->id}",
            'key_version' => $team->key_version,
        ]);

        return $member;
    }

    /**
     * @return array{Authorization: string}
     */
    private function bearerHeaders(User $user): array
    {
        $this->app->make(AuthManager::class)->forgetGuards();

        return ['Authorization' => 'Bearer '.$user->createToken('Vault feature test')->plainTextToken];
    }
}
