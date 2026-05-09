<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Filament\Resources\AuditLogs\AuditLogResource;
use App\Filament\Resources\Permissions\PermissionResource;
use App\Filament\Resources\Teams\TeamResource;
use App\Filament\Resources\Users\UserResource;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class AdminPanelTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
    }

    public function test_admin_panel_requires_an_authenticated_admin_user_with_two_factor_enabled(): void
    {
        $this->get('/admin')->assertRedirect('/admin/login');

        $user = $this->createUser(role: 'user', twoFactor: true);

        $this->actingAs($user)
            ->get('/admin')
            ->assertForbidden();

        $adminWithoutTwoFactor = $this->createUser(role: 'admin');

        $this->actingAs($adminWithoutTwoFactor)
            ->get('/admin')
            ->assertRedirect('/admin/multi-factor-authentication/set-up');

        $admin = $this->createUser(role: 'admin', twoFactor: true);

        $this->actingAs($admin)
            ->get('/admin')
            ->assertOk();
    }

    public function test_admin_panel_does_not_500_when_admin_user_has_no_name(): void
    {
        // Registration accepts a null `name` (the client only collects email +
        // master password), so the admin's name column is often null. Filament
        // 4's strict-typed FilamentManager::getUserName() returned null in
        // that case and crashed the admin shell — the User model now
        // implements HasName and falls back to the email address.
        $admin = $this->createUser(role: 'admin', twoFactor: true);
        $admin->forceFill(['name' => null])->save();

        $this->actingAs($admin)
            ->get('/admin')
            ->assertOk();

        self::assertSame($admin->email, $admin->fresh()->getFilamentName());
    }

    public function test_filament_does_not_expose_a_registration_page(): void
    {
        // Phase 4 makes the client app the canonical first-user signup flow:
        // it derives a master password, generates the X25519 keypair, and
        // uploads real vault material. A Filament-side signup would have to
        // fake those columns and the resulting user could never unlock the
        // client. The /admin/register route must stay disabled.
        $this->get('/admin/register')->assertNotFound();
    }

    public function test_admin_can_open_phase_two_admin_pages(): void
    {
        $admin = $this->createUser(role: 'admin', twoFactor: true);

        foreach ([
            '/admin/users',
            '/admin/roles',
            '/admin/permissions',
            '/admin/invites',
            '/admin/teams',
            '/admin/audit-logs',
            '/admin/settings',
            '/admin/system-health',
        ] as $path) {
            $this->actingAs($admin)
                ->get($path)
                ->assertOk();
        }
    }

    public function test_read_only_admin_resources_do_not_register_mutation_routes(): void
    {
        $admin = $this->createUser(role: 'admin', twoFactor: true);

        $this->actingAs($admin)
            ->get('/admin/permissions/create')
            ->assertNotFound();

        $this->actingAs($admin)
            ->get('/admin/audit-logs/create')
            ->assertNotFound();

        self::assertFalse(PermissionResource::canCreate());
        self::assertFalse(AuditLogResource::canCreate());
    }

    public function test_user_resource_does_not_allow_admin_created_users_or_deletes(): void
    {
        $admin = $this->createUser(role: 'admin', twoFactor: true);

        $this->actingAs($admin);

        self::assertFalse(UserResource::canCreate());
        self::assertFalse(UserResource::canDelete($admin));
    }

    public function test_team_resource_is_gated_read_only_and_can_show_membership(): void
    {
        $admin = $this->createUser(role: 'admin', twoFactor: true);
        $user = $this->createUser(role: 'user', twoFactor: true);
        $team = $this->createTeam($admin);
        $this->createMembership($team, $user, TeamMember::ROLE_MEMBER);

        $this->actingAs($user)
            ->get('/admin/teams')
            ->assertForbidden();

        $this->actingAs($admin)
            ->get('/admin/teams')
            ->assertOk();

        $this->actingAs($admin)
            ->get("/admin/teams/{$team->id}")
            ->assertOk();

        $this->actingAs($admin);

        self::assertTrue(TeamResource::canViewAny());
        self::assertFalse(TeamResource::canCreate());
        self::assertFalse(TeamResource::canEdit($team));
        self::assertTrue(TeamResource::canDelete($team));
    }

    private function createUser(string $role, bool $twoFactor = false): User
    {
        /** @var User $user */
        $user = User::factory()->create([
            'two_fa_enabled_at' => $twoFactor ? now() : null,
            'two_fa_secret_enc' => $twoFactor ? 'TESTTOTPSECRET' : null,
        ]);

        $user->assignRole($role);

        return $user;
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
}
