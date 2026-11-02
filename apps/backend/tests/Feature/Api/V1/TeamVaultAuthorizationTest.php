<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Enums\TeamAction;
use App\Enums\TeamRole;
use App\Models\AppSetting;
use App\Models\AuditLog;
use App\Models\Group;
use App\Models\Host;
use App\Models\HostCredential;
use App\Models\Identity;
use App\Models\Snippet;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\Tunnel;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Auth\AuthManager;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Team-role × operation matrix for team-scoped vault records.
 *
 * The server is the authority: every team-scoped operation must pass BOTH the
 * global Spatie permission (route middleware) AND the caller's team role.
 * Expected matrix (least-privilege reading of PROJECT_BRIEF §5.3):
 *
 *   role    read  create  update  delete  connect
 *   owner    ✓      ✓       ✓       ✓        ✓
 *   admin    ✓      ✓       ✓       ✓        ✓
 *   member   ✓      ✓       ✓       ✓        ✓
 *   viewer   ✓      ✗       ✗       ✗        ✗
 *
 * The expectations are spelled out here on purpose instead of being read from
 * the production matrix, so a change to the matrix has to change this file too.
 */
final class TeamVaultAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    /** @var array<string, array{read: bool, create: bool, update: bool, delete: bool, connect: bool}> */
    private const array EXPECTED = [
        'owner' => ['read' => true, 'create' => true, 'update' => true, 'delete' => true, 'connect' => true],
        'admin' => ['read' => true, 'create' => true, 'update' => true, 'delete' => true, 'connect' => true],
        'member' => ['read' => true, 'create' => true, 'update' => true, 'delete' => true, 'connect' => true],
        'viewer' => ['read' => true, 'create' => false, 'update' => false, 'delete' => false, 'connect' => false],
    ];

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
    }

    /**
     * @return array<string, array{string, bool}>
     */
    public static function rolesAndGlobalPermission(): array
    {
        $cases = [];

        foreach (array_keys(self::EXPECTED) as $role) {
            $cases["{$role}, global permission present"] = [$role, true];
            $cases["{$role}, global permission absent"] = [$role, false];
        }

        return $cases;
    }

    #[DataProvider('rolesAndGlobalPermission')]
    public function test_list_and_show_of_team_records_follow_the_team_role(string $role, bool $withGlobal): void
    {
        ['team' => $team, 'actor' => $actor, 'records' => $records] = $this->fixture($role, $withGlobal);
        $headers = $this->bearerHeaders($actor);
        $allowed = self::expectsAllowed($role, 'read', $withGlobal);

        foreach ($records as $type => $record) {
            $list = $this->getJson("/api/v1/vault/{$type}?team={$team->id}", $headers);
            $show = $this->getJson("/api/v1/vault/{$type}/{$record->getKey()}", $headers);

            if ($allowed) {
                $list->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', (string) $record->getKey());
                $show->assertOk()->assertJsonPath('data.id', (string) $record->getKey());
            } else {
                $list->assertForbidden();
                $show->assertForbidden();
            }
        }
    }

    #[DataProvider('rolesAndGlobalPermission')]
    public function test_creating_team_records_follows_the_team_role(string $role, bool $withGlobal): void
    {
        ['team' => $team, 'actor' => $actor] = $this->fixture($role, $withGlobal);
        $headers = $this->bearerHeaders($actor);
        $allowed = self::expectsAllowed($role, 'create', $withGlobal);

        foreach (self::resources() as $type => $resource) {
            $before = $resource['model']::query()->where('team_id', $team->id)->count();

            $response = $this->postJson("/api/v1/vault/{$type}", [
                'team_id' => $team->id,
                ...$resource['payload'],
            ], $headers);

            $after = $resource['model']::query()->where('team_id', $team->id)->count();

            if ($allowed) {
                $response->assertCreated()->assertJsonPath('data.team_id', $team->id);
                self::assertSame($before + 1, $after, $type);
            } else {
                $response->assertForbidden();
                self::assertSame($before, $after, $type);
            }
        }
    }

    #[DataProvider('rolesAndGlobalPermission')]
    public function test_updating_team_records_follows_the_team_role(string $role, bool $withGlobal): void
    {
        ['actor' => $actor, 'records' => $records] = $this->fixture($role, $withGlobal);
        $headers = $this->bearerHeaders($actor);
        $allowed = self::expectsAllowed($role, 'update', $withGlobal);
        $resources = self::resources();

        foreach ($records as $type => $record) {
            $field = $resources[$type]['field'];
            $original = $record->getAttribute($field);

            $response = $this->patchJson("/api/v1/vault/{$type}/{$record->getKey()}", [
                $field => "changed-by-{$role}",
            ], $headers);

            $record->refresh();

            if ($allowed) {
                $response->assertOk();
                self::assertSame("changed-by-{$role}", $record->getAttribute($field), $type);
            } else {
                $response->assertForbidden();
                self::assertSame($original, $record->getAttribute($field), $type);
            }
        }
    }

    #[DataProvider('rolesAndGlobalPermission')]
    public function test_deleting_team_records_follows_the_team_role(string $role, bool $withGlobal): void
    {
        ['actor' => $actor, 'records' => $records] = $this->fixture($role, $withGlobal);
        $headers = $this->bearerHeaders($actor);
        $allowed = self::expectsAllowed($role, 'delete', $withGlobal);

        foreach ($records as $record) {
            $response = $this->deleteJson("/api/v1/vault/{$this->typeOf($record)}/{$record->getKey()}", [], $headers);

            if ($allowed) {
                $response->assertNoContent();
                $this->assertSoftDeleted($record->getTable(), ['id' => $record->getKey()]);
            } else {
                $response->assertForbidden();
                $this->assertNotSoftDeleted($record->getTable(), ['id' => $record->getKey()]);
            }
        }
    }

    #[DataProvider('rolesAndGlobalPermission')]
    public function test_delta_sync_includes_team_records_only_when_permission_and_team_role_allow(string $role, bool $withGlobal): void
    {
        ['actor' => $actor, 'records' => $records] = $this->fixture($role, $withGlobal);
        $cursor = now()->subMinute()->toIso8601String();
        $allowed = self::expectsAllowed($role, 'read', $withGlobal);

        $sync = $this->getJson('/api/v1/vault/sync?cursor='.rawurlencode($cursor), $this->bearerHeaders($actor))
            ->assertOk();

        foreach ($records as $type => $record) {
            /** @var list<array{id: string}> $rows */
            $rows = $sync->json("data.{$type}") ?? [];
            $ids = array_column($rows, 'id');

            self::assertSame($allowed, in_array((string) $record->getKey(), $ids, true), $type);
        }
    }

    #[DataProvider('rolesAndGlobalPermission')]
    public function test_web_ssh_tokens_for_team_hosts_follow_the_team_role(string $role, bool $withGlobal): void
    {
        $this->enableWebSsh();
        ['actor' => $actor, 'records' => $records] = $this->fixture($role, $withGlobal);
        $allowed = self::expectsAllowed($role, 'connect', $withGlobal);

        $response = $this->postJson('/api/v1/ws/ssh-token', [
            'host_id' => (string) $records['hosts']->getKey(),
            'host' => 'ssh.example.com',
            'port' => 22,
        ], $this->bearerHeaders($actor));

        if ($allowed) {
            $response->assertCreated();
        } else {
            $response->assertForbidden();
            self::assertFalse(AuditLog::query()->where('action', 'ssh.token.created')->exists());
        }
    }

    public function test_team_host_creator_loses_write_and_connect_after_demotion_or_removal(): void
    {
        $this->enableWebSsh();
        ['team' => $team, 'actor' => $creator] = $this->fixture(TeamMember::ROLE_MEMBER, true);

        /** @var Host $host */
        $host = Host::query()->forceCreate([
            'user_id' => $creator->id,
            'team_id' => $team->id,
            ...self::resources()['hosts']['payload'],
        ]);

        TeamMember::query()
            ->where('team_id', $team->id)
            ->where('user_id', $creator->id)
            ->update(['role' => TeamMember::ROLE_VIEWER]);

        $this->postJson('/api/v1/ws/ssh-token', ['host_id' => $host->id, 'host' => 'ssh.example.com', 'port' => 22], $this->bearerHeaders($creator))
            ->assertForbidden();

        $this->patchJson("/api/v1/vault/hosts/{$host->id}", ['name_ciphertext' => 'creator-as-viewer'], $this->bearerHeaders($creator))
            ->assertForbidden();

        TeamMember::query()->where('team_id', $team->id)->where('user_id', $creator->id)->delete();

        $this->postJson('/api/v1/ws/ssh-token', ['host_id' => $host->id, 'host' => 'ssh.example.com', 'port' => 22], $this->bearerHeaders($creator))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['host_id']);

        $this->getJson("/api/v1/vault/hosts/{$host->id}", $this->bearerHeaders($creator))
            ->assertForbidden();
    }

    public function test_viewer_cannot_change_or_delete_a_shared_host_through_the_public_api(): void
    {
        // Regression: mirrors the end-to-end API sequence used to reproduce
        // the issue against PostgreSQL — the owner creates a team, adds a
        // viewer and creates a shared host; the viewer must not be able to
        // modify or delete it.
        $owner = User::factory()->create();
        $owner->assignRole(['admin', 'user']);
        $viewer = User::factory()->create();
        $viewer->assignRole('user');

        $teamId = (string) $this->postJson('/api/v1/teams', [
            'name_ciphertext' => 'sample',
            'name_nonce' => 'sample',
            'wrapped_team_key_ciphertext' => 'sample',
            'wrapped_team_key_nonce' => 'sample',
        ], $this->bearerHeaders($owner))->assertCreated()->json('data.id');

        $this->postJson("/api/v1/teams/{$teamId}/members", [
            'user_id' => $viewer->id,
            'role' => 'viewer',
            'wrapped_team_key_ciphertext' => 'sample',
            'wrapped_team_key_nonce' => 'sample',
        ], $this->bearerHeaders($owner))->assertCreated();

        $hostId = (string) $this->postJson('/api/v1/vault/hosts', [
            'team_id' => $teamId,
            'name_ciphertext' => 'sample',
            'name_nonce' => 'sample',
            'hostname_ciphertext' => 'sample',
            'hostname_nonce' => 'sample',
        ], $this->bearerHeaders($owner))->assertCreated()->json('data.id');

        $this->patchJson("/api/v1/vault/hosts/{$hostId}", [
            'name_ciphertext' => 'modified',
            'name_nonce' => 'sample',
        ], $this->bearerHeaders($viewer))->assertForbidden();

        $this->deleteJson("/api/v1/vault/hosts/{$hostId}", [], $this->bearerHeaders($viewer))
            ->assertForbidden();

        $host = Host::query()->findOrFail($hostId);
        self::assertSame('sample', $host->name_ciphertext);
        $this->assertNotSoftDeleted('hosts', ['id' => $hostId]);
        self::assertFalse(AuditLog::query()->where('action', 'vault.hosts.updated')->exists());
        self::assertFalse(AuditLog::query()->where('action', 'vault.hosts.deleted')->exists());
    }

    public function test_team_roles_never_grant_access_to_personal_records(): void
    {
        ['owner' => $owner, 'actor' => $admin] = $this->fixture(TeamMember::ROLE_ADMIN, true);

        /** @var Host $personal */
        $personal = Host::query()->forceCreate([
            'user_id' => $owner->id,
            ...self::resources()['hosts']['payload'],
        ]);

        $this->getJson("/api/v1/vault/hosts/{$personal->id}", $this->bearerHeaders($admin))->assertForbidden();
        $this->patchJson("/api/v1/vault/hosts/{$personal->id}", ['name_ciphertext' => 'x'], $this->bearerHeaders($admin))->assertForbidden();
        $this->deleteJson("/api/v1/vault/hosts/{$personal->id}", [], $this->bearerHeaders($admin))->assertForbidden();
    }

    public function test_stored_team_roles_and_the_role_matrix_stay_in_sync(): void
    {
        self::assertSame(
            TeamMember::ROLES,
            array_map(static fn (TeamRole $role): string => $role->value, TeamRole::cases()),
        );

        foreach (self::EXPECTED as $role => $expected) {
            $teamRole = TeamRole::from($role);

            self::assertSame($expected['read'], $teamRole->allows(TeamAction::ReadRecords), $role);
            self::assertSame($expected['create'], $teamRole->allows(TeamAction::CreateRecords), $role);
            self::assertSame($expected['update'], $teamRole->allows(TeamAction::UpdateRecords), $role);
            self::assertSame($expected['delete'], $teamRole->allows(TeamAction::DeleteRecords), $role);
            self::assertSame($expected['connect'], $teamRole->allows(TeamAction::ConnectHosts), $role);
        }

        $unknown = new TeamMember(['role' => 'superuser']);

        foreach (TeamAction::cases() as $action) {
            self::assertFalse($unknown->allows($action), $action->value);
        }
    }

    /**
     * Minimal valid payload and model class per team-scoped vault resource type.
     *
     * @return array<string, array{model: class-string<Model>, payload: array<string, string>, field: string}>
     */
    private static function resources(): array
    {
        return [
            'groups' => [
                'model' => Group::class,
                'payload' => ['name_ciphertext' => 'group-name-ct', 'name_nonce' => 'group-name-nonce'],
                'field' => 'name_ciphertext',
            ],
            'hosts' => [
                'model' => Host::class,
                'payload' => [
                    'name_ciphertext' => 'host-name-ct',
                    'name_nonce' => 'host-name-nonce',
                    'hostname_ciphertext' => 'host-address-ct',
                    'hostname_nonce' => 'host-address-nonce',
                ],
                'field' => 'name_ciphertext',
            ],
            'host-credentials' => [
                'model' => HostCredential::class,
                'payload' => ['label_ciphertext' => 'credential-label-ct', 'label_nonce' => 'credential-label-nonce'],
                'field' => 'label_ciphertext',
            ],
            'snippets' => [
                'model' => Snippet::class,
                'payload' => [
                    'title_ciphertext' => 'snippet-title-ct',
                    'title_nonce' => 'snippet-title-nonce',
                    'body_ciphertext' => 'snippet-body-ct',
                    'body_nonce' => 'snippet-body-nonce',
                ],
                'field' => 'title_ciphertext',
            ],
            'identities' => [
                'model' => Identity::class,
                'payload' => [
                    'name_ciphertext' => 'identity-name-ct',
                    'name_nonce' => 'identity-name-nonce',
                    'private_key_ciphertext' => 'identity-key-ct',
                    'private_key_nonce' => 'identity-key-nonce',
                ],
                'field' => 'name_ciphertext',
            ],
            'tunnels' => [
                'model' => Tunnel::class,
                'payload' => [
                    'name_ciphertext' => 'tunnel-name-ct',
                    'name_nonce' => 'tunnel-name-nonce',
                    'config_ciphertext' => 'tunnel-config-ct',
                    'config_nonce' => 'tunnel-config-nonce',
                ],
                'field' => 'name_ciphertext',
            ],
        ];
    }

    /**
     * The global Spatie permission is required in addition to the team role.
     */
    private static function expectsAllowed(string $role, string $operation, bool $withGlobalPermission): bool
    {
        if (! $withGlobalPermission) {
            return false;
        }

        return self::EXPECTED[$role][$operation] ?? false;
    }

    private function typeOf(Model $record): string
    {
        foreach (self::resources() as $type => $resource) {
            if ($record instanceof $resource['model']) {
                return $type;
            }
        }

        self::fail('Unknown vault record class '.$record::class);
    }

    /**
     * A team owned by a separate user, with the actor holding $role and one
     * owner-created record per team-scoped vault resource type.
     *
     * @return array{team: Team, owner: User, actor: User, records: array<string, Model>}
     */
    private function fixture(string $role, bool $withGlobalPermissions): array
    {
        $owner = User::factory()->create();
        $owner->assignRole('user');

        /** @var Team $team */
        $team = Team::query()->create([
            'created_by_user_id' => $owner->id,
            'name_ciphertext' => 'team-name-ct',
            'name_nonce' => 'team-name-nonce',
            'key_version' => 1,
        ]);
        $this->createMembership($team, $owner, TeamMember::ROLE_OWNER);

        $actor = User::factory()->create();

        if ($withGlobalPermissions) {
            $actor->assignRole('user');
        }

        $this->createMembership($team, $actor, $role);

        $records = [];

        foreach (self::resources() as $type => $resource) {
            /** @var Model $record */
            $record = new $resource['model'];
            $record->forceFill([
                ...$resource['payload'],
                'user_id' => $owner->id,
                'team_id' => $team->id,
            ])->save();
            $records[$type] = $record;
        }

        return ['team' => $team, 'owner' => $owner, 'actor' => $actor, 'records' => $records];
    }

    private function createMembership(Team $team, User $user, string $role): TeamMember
    {
        /** @var TeamMember $member */
        $member = TeamMember::query()->create([
            'team_id' => $team->id,
            'user_id' => $user->id,
            'role' => $role,
            'wrapped_team_key_ciphertext' => "wrapped-{$role}-{$user->id}",
            'wrapped_team_key_nonce' => "nonce-{$role}-{$user->id}",
            'key_version' => $team->key_version,
        ]);

        return $member;
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

    /**
     * @return array{Authorization: string}
     */
    private function bearerHeaders(User $user): array
    {
        $this->app->make(AuthManager::class)->forgetGuards();

        return ['Authorization' => 'Bearer '.$user->createToken('Team vault authorization test')->plainTextToken];
    }
}
