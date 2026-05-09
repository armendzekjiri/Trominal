<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Models\AuditLog;
use App\Models\Host;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Auth\AuthManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

final class TeamsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
    }

    public function test_creates_updates_and_deletes_team_with_encrypted_metadata_and_owner_membership(): void
    {
        $user = $this->userWithRole('user');
        $headers = $this->bearerHeaders($user);
        $teamId = '01JZ1000000000000000000000';

        $create = $this->postJson('/api/v1/teams', [
            'id' => $teamId,
            ...self::teamPayload(),
        ], $headers);

        $create
            ->assertCreated()
            ->assertJsonPath('data.id', $teamId)
            ->assertJsonPath('data.name_ciphertext', 'team-name-ciphertext')
            ->assertJsonPath('data.key_version', 1)
            ->assertJsonPath('data.current_member.role', TeamMember::ROLE_OWNER)
            ->assertJsonCount(1, 'data.members');

        $rawTeamName = DB::table('teams')->where('id', $teamId)->value('name_ciphertext');
        $rawWrappedKey = DB::table('team_members')->where('team_id', $teamId)->value('wrapped_team_key_ciphertext');

        self::assertIsString($rawTeamName);
        self::assertIsString($rawWrappedKey);
        self::assertNotSame('team-name-ciphertext', $rawTeamName);
        self::assertNotSame('owner-wrapped-team-key', $rawWrappedKey);

        $this->patchJson("/api/v1/teams/{$teamId}", [
            'name_ciphertext' => 'updated-team-name-ciphertext',
            'name_nonce' => 'updated-team-name-nonce',
        ], $headers)
            ->assertOk()
            ->assertJsonPath('data.name_ciphertext', 'updated-team-name-ciphertext');

        $this->deleteJson("/api/v1/teams/{$teamId}", [], $headers)
            ->assertNoContent();

        $this->assertSoftDeleted('teams', ['id' => $teamId]);
        self::assertSame(1, AuditLog::query()->where('action', 'team.created')->count());
        self::assertSame(1, AuditLog::query()->where('action', 'team.updated')->count());
        self::assertSame(1, AuditLog::query()->where('action', 'team.deleted')->count());
    }

    public function test_lists_only_teams_where_user_is_member(): void
    {
        $user = $this->userWithRole('user');
        $otherUser = $this->userWithRole('user');
        $team = $this->createTeamForOwner($user, name: 'owned-team-ciphertext');
        $this->createTeamForOwner($otherUser, name: 'other-team-ciphertext');

        $this->getJson('/api/v1/teams', $this->bearerHeaders($user))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $team->id)
            ->assertJsonPath('data.0.name_ciphertext', 'owned-team-ciphertext')
            ->assertJsonPath('data.0.current_member.role', TeamMember::ROLE_OWNER);
    }

    public function test_owner_looks_up_user_adds_member_and_member_can_view_team_members(): void
    {
        $owner = $this->userWithRole('user');
        $memberUser = $this->userWithRole('user');
        $team = $this->createTeamForOwner($owner);
        $headers = $this->bearerHeaders($owner);

        $this->getJson('/api/v1/teams/users/lookup?email='.rawurlencode($memberUser->email), $headers)
            ->assertOk()
            ->assertJsonPath('data.id', $memberUser->id)
            ->assertJsonPath('data.public_key', $memberUser->public_key);

        $memberPayload = self::memberPayload($memberUser, TeamMember::ROLE_MEMBER);

        $add = $this->postJson("/api/v1/teams/{$team->id}/members", $memberPayload, $headers);

        $add
            ->assertCreated()
            ->assertJsonPath('data.user_id', $memberUser->id)
            ->assertJsonPath('data.role', TeamMember::ROLE_MEMBER)
            ->assertJsonPath('data.wrapped_team_key_ciphertext', $memberPayload['wrapped_team_key_ciphertext'])
            ->assertJsonPath('data.user.email', $memberUser->email);

        $this->forgetAuthGuards();

        $this->getJson("/api/v1/teams/{$team->id}", $this->bearerHeaders($memberUser))
            ->assertOk()
            ->assertJsonPath('data.current_member.role', TeamMember::ROLE_MEMBER)
            ->assertJsonCount(2, 'data.members');

        $this->getJson("/api/v1/teams/{$team->id}/members", $this->bearerHeaders($memberUser))
            ->assertOk()
            ->assertJsonCount(2, 'data');

        self::assertSame(1, AuditLog::query()->where('action', 'team.member.added')->count());
    }

    public function test_member_management_requires_team_admin_or_owner(): void
    {
        $owner = $this->userWithRole('user');
        $memberUser = $this->userWithRole('user');
        $targetUser = $this->userWithRole('user');
        $team = $this->createTeamForOwner($owner);
        $this->createMembership($team, $memberUser, TeamMember::ROLE_MEMBER);
        $memberHeaders = $this->bearerHeaders($memberUser);

        $this->postJson(
            "/api/v1/teams/{$team->id}/members",
            self::memberPayload($targetUser, TeamMember::ROLE_MEMBER),
            $memberHeaders,
        )->assertForbidden();

        $this->patchJson("/api/v1/teams/{$team->id}", [
            'name_ciphertext' => 'member-update-ciphertext',
            'name_nonce' => 'member-update-nonce',
        ], $memberHeaders)->assertForbidden();
    }

    public function test_role_changes_preserve_owner_controls(): void
    {
        $owner = $this->userWithRole('user');
        $adminUser = $this->userWithRole('user');
        $team = $this->createTeamForOwner($owner);
        $ownerMember = TeamMember::query()
            ->where('team_id', $team->id)
            ->where('user_id', $owner->id)
            ->firstOrFail();
        $adminMember = $this->createMembership($team, $adminUser, TeamMember::ROLE_ADMIN);

        $this->patchJson("/api/v1/teams/{$team->id}/members/{$ownerMember->id}", [
            'role' => TeamMember::ROLE_VIEWER,
        ], $this->bearerHeaders($owner))->assertUnprocessable();

        $this->forgetAuthGuards();

        $this->patchJson("/api/v1/teams/{$team->id}/members/{$adminMember->id}", [
            'role' => TeamMember::ROLE_OWNER,
        ], $this->bearerHeaders($adminUser))->assertForbidden();

        $this->forgetAuthGuards();

        $this->patchJson("/api/v1/teams/{$team->id}/members/{$adminMember->id}", [
            'role' => TeamMember::ROLE_VIEWER,
        ], $this->bearerHeaders($owner))
            ->assertOk()
            ->assertJsonPath('data.role', TeamMember::ROLE_VIEWER);

        self::assertSame(1, AuditLog::query()->where('action', 'team.member.role_changed')->count());
    }

    public function test_removing_member_requires_rotation_payload_for_every_remaining_member(): void
    {
        $owner = $this->userWithRole('user');
        $adminUser = $this->userWithRole('user');
        $memberUser = $this->userWithRole('user');
        $team = $this->createTeamForOwner($owner);
        $ownerMember = TeamMember::query()
            ->where('team_id', $team->id)
            ->where('user_id', $owner->id)
            ->firstOrFail();
        $adminMember = $this->createMembership($team, $adminUser, TeamMember::ROLE_ADMIN);
        $member = $this->createMembership($team, $memberUser, TeamMember::ROLE_MEMBER);
        $headers = $this->bearerHeaders($owner);

        $this->deleteJson("/api/v1/teams/{$team->id}/members/{$member->id}", [
            'remaining_members' => [
                [
                    'member_id' => $ownerMember->id,
                    'wrapped_team_key_ciphertext' => 'rotated-owner-wrap',
                    'wrapped_team_key_nonce' => 'rotated-owner-nonce',
                ],
            ],
            'reencrypted_resources' => [],
        ], $headers)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['remaining_members']);

        $this->deleteJson("/api/v1/teams/{$team->id}/members/{$member->id}", [
            'remaining_members' => [
                [
                    'member_id' => $ownerMember->id,
                    'wrapped_team_key_ciphertext' => 'rotated-owner-wrap',
                    'wrapped_team_key_nonce' => 'rotated-owner-nonce',
                ],
                [
                    'member_id' => $adminMember->id,
                    'wrapped_team_key_ciphertext' => 'rotated-admin-wrap',
                    'wrapped_team_key_nonce' => 'rotated-admin-nonce',
                ],
            ],
            'reencrypted_resources' => [],
        ], $headers)->assertNoContent();

        $team->refresh();
        $ownerMember->refresh();
        $adminMember->refresh();

        self::assertSame(2, $team->key_version);
        self::assertSame(2, $ownerMember->key_version);
        self::assertSame(2, $adminMember->key_version);
        self::assertSame('rotated-owner-wrap', $ownerMember->wrapped_team_key_ciphertext);
        self::assertSame('rotated-admin-wrap', $adminMember->wrapped_team_key_ciphertext);
        self::assertFalse(TeamMember::query()->whereKey($member->id)->exists());
        self::assertSame(1, AuditLog::query()->where('action', 'team.member.removed')->count());
    }

    public function test_removing_member_requires_reencryption_of_every_team_scoped_record(): void
    {
        // The brief (§5.3) requires resource ciphertext to be re-encrypted
        // under a fresh team key on member removal — otherwise the removed
        // member's retained plaintext team key still decrypts the records.
        // The service rejects any payload that omits or duplicates rows.
        $owner = $this->userWithRole('user');
        $memberUser = $this->userWithRole('user');
        $team = $this->createTeamForOwner($owner);
        $ownerMember = TeamMember::query()
            ->where('team_id', $team->id)
            ->where('user_id', $owner->id)
            ->firstOrFail();
        $member = $this->createMembership($team, $memberUser, TeamMember::ROLE_MEMBER);
        $headers = $this->bearerHeaders($owner);

        /** @var Host $host */
        $host = Host::query()->create([
            'user_id' => $owner->id,
            'team_id' => $team->id,
            'name_ciphertext' => 'old-name-ct',
            'name_nonce' => 'old-name-nonce',
            'hostname_ciphertext' => 'old-hostname-ct',
            'hostname_nonce' => 'old-hostname-nonce',
        ]);

        // Missing host re-encryption rejects.
        $this->deleteJson("/api/v1/teams/{$team->id}/members/{$member->id}", [
            'remaining_members' => [[
                'member_id' => $ownerMember->id,
                'wrapped_team_key_ciphertext' => 'rotated-owner-wrap',
                'wrapped_team_key_nonce' => 'rotated-owner-nonce',
            ]],
            'reencrypted_resources' => [],
        ], $headers)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['reencrypted_resources']);

        // Unexpected record id rejects.
        $this->deleteJson("/api/v1/teams/{$team->id}/members/{$member->id}", [
            'remaining_members' => [[
                'member_id' => $ownerMember->id,
                'wrapped_team_key_ciphertext' => 'rotated-owner-wrap',
                'wrapped_team_key_nonce' => 'rotated-owner-nonce',
            ]],
            'reencrypted_resources' => [[
                'type' => 'hosts',
                'id' => '01J0FAKEHOSTID0000000000000',
                'fields' => [
                    'name_ciphertext' => 'new-name-ct',
                    'name_nonce' => 'new-name-nonce',
                ],
            ]],
        ], $headers)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['reencrypted_resources']);

        // Field outside the ciphertext allowlist rejects.
        $this->deleteJson("/api/v1/teams/{$team->id}/members/{$member->id}", [
            'remaining_members' => [[
                'member_id' => $ownerMember->id,
                'wrapped_team_key_ciphertext' => 'rotated-owner-wrap',
                'wrapped_team_key_nonce' => 'rotated-owner-nonce',
            ]],
            'reencrypted_resources' => [[
                'type' => 'hosts',
                'id' => (string) $host->id,
                // team_id sneaking in would let a malicious caller move the
                // record between teams during rotation.
                'fields' => ['team_id' => null],
            ]],
        ], $headers)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['reencrypted_resources']);

        // Complete payload succeeds, ciphertext rotates, audit log records the count.
        $this->deleteJson("/api/v1/teams/{$team->id}/members/{$member->id}", [
            'remaining_members' => [[
                'member_id' => $ownerMember->id,
                'wrapped_team_key_ciphertext' => 'rotated-owner-wrap',
                'wrapped_team_key_nonce' => 'rotated-owner-nonce',
            ]],
            'reencrypted_resources' => [[
                'type' => 'hosts',
                'id' => (string) $host->id,
                'fields' => [
                    'name_ciphertext' => 'rotated-name-ct',
                    'name_nonce' => 'rotated-name-nonce',
                    'hostname_ciphertext' => 'rotated-hostname-ct',
                    'hostname_nonce' => 'rotated-hostname-nonce',
                ],
            ]],
        ], $headers)->assertNoContent();

        $host->refresh();
        // `name_ciphertext` is a Laravel `encrypted` cast (defense in depth);
        // the cast unwraps the wire ciphertext that the client sent.
        self::assertSame('rotated-name-ct', $host->name_ciphertext);
        self::assertSame('rotated-hostname-ct', $host->hostname_ciphertext);

        $audit = AuditLog::query()->where('action', 'team.member.removed')->latest('id')->firstOrFail();
        self::assertSame(1, ($audit->metadata['resources_rotated'] ?? null));
    }

    public function test_rejects_team_writes_without_required_spatie_permission(): void
    {
        $user = User::factory()->create();

        $this->postJson('/api/v1/teams', self::teamPayload(), $this->bearerHeaders($user))
            ->assertForbidden();
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    /**
     * @return array{name_ciphertext: string, name_nonce: string, wrapped_team_key_ciphertext: string, wrapped_team_key_nonce: string}
     */
    private static function teamPayload(): array
    {
        return [
            'name_ciphertext' => 'team-name-ciphertext',
            'name_nonce' => 'team-name-nonce',
            'wrapped_team_key_ciphertext' => 'owner-wrapped-team-key',
            'wrapped_team_key_nonce' => 'owner-wrapped-team-key-nonce',
        ];
    }

    /**
     * @return array{user_id: string, role: string, wrapped_team_key_ciphertext: string, wrapped_team_key_nonce: string}
     */
    private static function memberPayload(User $user, string $role): array
    {
        return [
            'user_id' => (string) $user->id,
            'role' => $role,
            'wrapped_team_key_ciphertext' => "wrapped-team-key-for-{$user->id}",
            'wrapped_team_key_nonce' => "wrapped-team-key-nonce-for-{$user->id}",
        ];
    }

    private function createTeamForOwner(User $owner, string $name = 'team-name-ciphertext'): Team
    {
        /** @var Team $team */
        $team = Team::query()->create([
            'created_by_user_id' => $owner->id,
            'name_ciphertext' => $name,
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
        return ['Authorization' => 'Bearer '.$user->createToken('Teams feature test')->plainTextToken];
    }

    private function forgetAuthGuards(): void
    {
        $this->app->make(AuthManager::class)->forgetGuards();
    }
}
