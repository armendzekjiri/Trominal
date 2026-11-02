<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Filament\Pages\Settings;
use App\Filament\Resources\Invites\Pages\CreateInvite;
use App\Filament\Resources\Invites\Pages\EditInvite;
use App\Filament\Resources\Invites\Pages\ListInvites;
use App\Filament\Resources\Roles\Pages\CreateRole;
use App\Filament\Resources\Teams\Pages\ListTeams;
use App\Filament\Resources\Users\Pages\ListUsers;
use App\Models\AuditLog;
use App\Models\Invite;
use App\Models\Role;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Database\Seeders\AppSettingSeeder;
use Database\Seeders\RoleAndPermissionSeeder;
use Filament\Actions\Testing\TestAction;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Livewire\Livewire;
use Tests\TestCase;

/**
 * Every state-changing Filament admin action writes an audit entry
 * attributed to the acting administrator (CLAUDE.md working agreement).
 * Role deletes, user edits and suspension are covered in
 * AdminRoleSafetyTest and AdminSuspensionTest.
 */
final class AdminActionAuditTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(AppSettingSeeder::class);
        $this->seed(RoleAndPermissionSeeder::class);
        Filament::setCurrentPanel(Filament::getPanel('admin'));

        /** @var User $admin */
        $admin = User::factory()->create([
            'two_fa_enabled_at' => now(),
            'two_fa_secret_enc' => 'TESTTOTPSECRET',
        ]);
        $admin->assignRole(['admin', 'user']);
        $this->admin = $admin;
        $this->actingAs($admin);
    }

    public function test_creating_a_role_is_audited(): void
    {
        Livewire::test(CreateRole::class)
            ->fillForm(['name' => 'auditor'])
            ->call('create')
            ->assertHasNoFormErrors();

        $role = Role::findByName('auditor', 'web');
        $this->assertAudited('admin.role.created', (string) $role->id);
    }

    public function test_invite_lifecycle_is_audited_without_the_invite_code(): void
    {
        Livewire::test(CreateInvite::class)
            ->fillForm(['email' => 'invitee@example.test'])
            ->call('create')
            ->assertHasNoFormErrors();

        $invite = Invite::query()->firstOrFail();
        $this->assertAudited('admin.invite.created', (string) $invite->id);

        Livewire::test(EditInvite::class, ['record' => $invite->getRouteKey()])
            ->fillForm(['email' => 'other@example.test'])
            ->call('save')
            ->assertHasNoFormErrors();
        $this->assertAudited('admin.invite.updated', (string) $invite->id);

        Livewire::test(ListInvites::class)
            ->callAction(TestAction::make('revoke')->table($invite));
        $this->assertAudited('admin.invite.revoked', (string) $invite->id);

        foreach (AuditLog::query()->get() as $log) {
            self::assertStringNotContainsString((string) $invite->code_hash, (string) json_encode($log->toArray()));
        }
    }

    public function test_requesting_a_password_reset_is_audited(): void
    {
        // The reset mail itself is out of scope here; only the audit entry is.
        Notification::fake();
        $user = User::factory()->create();

        Livewire::test(ListUsers::class)
            ->callAction(TestAction::make('resetPassword')->table($user));

        $this->assertAudited('admin.user.password_reset_requested', (string) $user->id);
    }

    public function test_deleting_a_team_is_audited(): void
    {
        /** @var Team $team */
        $team = Team::query()->create([
            'created_by_user_id' => $this->admin->id,
            'name_ciphertext' => 'team-name-ct',
            'name_nonce' => 'team-name-nonce',
            'key_version' => 1,
        ]);
        TeamMember::query()->create([
            'team_id' => $team->id,
            'user_id' => $this->admin->id,
            'role' => TeamMember::ROLE_OWNER,
            'wrapped_team_key_ciphertext' => 'wrapped',
            'wrapped_team_key_nonce' => 'nonce',
            'key_version' => 1,
        ]);

        Livewire::test(ListTeams::class)
            ->callAction(TestAction::make('delete')->table($team));

        $this->assertSoftDeleted('teams', ['id' => $team->id]);
        $this->assertAudited('admin.team.deleted', (string) $team->id);
    }

    public function test_updating_instance_settings_is_audited(): void
    {
        Livewire::test(Settings::class)
            ->callAction('updateSettings', [
                'instance_name' => 'Audited instance',
                'mode' => 'invite',
                'open' => false,
                'web_ssh_enabled' => false,
            ]);

        self::assertTrue(AuditLog::query()
            ->where('action', 'admin.settings.updated')
            ->where('actor_user_id', $this->admin->id)
            ->exists());
    }

    private function assertAudited(string $action, string $resourceId): void
    {
        self::assertSame(1, AuditLog::query()
            ->where('action', $action)
            ->where('resource_id', $resourceId)
            ->where('actor_user_id', $this->admin->id)
            ->count(), $action);
    }
}
