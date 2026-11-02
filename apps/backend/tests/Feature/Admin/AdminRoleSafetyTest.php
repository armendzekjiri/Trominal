<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Filament\Resources\Roles\Pages\EditRole;
use App\Filament\Resources\Roles\Pages\ListRoles;
use App\Filament\Resources\Users\Pages\EditUser;
use App\Models\AuditLog;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\AppSettingSeeder;
use Database\Seeders\RoleAndPermissionSeeder;
use Filament\Actions\Testing\TestAction;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

final class AdminRoleSafetyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(AppSettingSeeder::class);
        $this->seed(RoleAndPermissionSeeder::class);
        Filament::setCurrentPanel(Filament::getPanel('admin'));
    }

    public function test_row_delete_of_a_custom_role_is_audited(): void
    {
        $admin = $this->createAdmin();
        $role = $this->customRole('auditor');
        $this->actingAs($admin);

        Livewire::test(ListRoles::class)
            ->callAction(TestAction::make('delete')->table($role));

        $this->assertDatabaseMissing('roles', ['id' => $role->id]);
        $this->assertAuditedOnce('admin.role.deleted', (string) $role->id, $admin);
    }

    public function test_edit_page_delete_of_a_custom_role_is_audited(): void
    {
        $admin = $this->createAdmin();
        $role = $this->customRole('auditor');
        $this->actingAs($admin);

        Livewire::test(EditRole::class, ['record' => $role->getRouteKey()])
            ->callAction('delete');

        $this->assertDatabaseMissing('roles', ['id' => $role->id]);
        $this->assertAuditedOnce('admin.role.deleted', (string) $role->id, $admin);
    }

    public function test_bulk_delete_audits_each_custom_role_and_never_deletes_default_roles(): void
    {
        $admin = $this->createAdmin();
        $first = $this->customRole('auditor');
        $second = $this->customRole('support');
        $defaults = Role::query()->whereIn('name', ['admin', 'user', 'guest'])->get();
        $this->actingAs($admin);

        Livewire::test(ListRoles::class)
            ->selectTableRecords([$first->getKey(), $second->getKey(), ...$defaults->modelKeys()])
            ->callAction(TestAction::make('delete')->table()->bulk());

        $this->assertDatabaseMissing('roles', ['id' => $first->id]);
        $this->assertDatabaseMissing('roles', ['id' => $second->id]);

        foreach (['admin', 'user', 'guest'] as $name) {
            $this->assertDatabaseHas('roles', ['name' => $name]);
        }

        $this->assertAuditedOnce('admin.role.deleted', (string) $first->id, $admin);
        $this->assertAuditedOnce('admin.role.deleted', (string) $second->id, $admin);
        self::assertSame(2, AuditLog::query()->where('action', 'admin.role.deleted')->count());
        self::assertTrue($admin->fresh()?->hasRole('admin'));
    }

    public function test_default_role_names_are_immutable(): void
    {
        $admin = $this->createAdmin();
        $adminRole = Role::findByName('admin', 'web');
        $this->actingAs($admin);

        Livewire::test(EditRole::class, ['record' => $adminRole->getRouteKey()])
            ->assertFormFieldIsDisabled('name')
            ->fillForm(['name' => 'operators'])
            ->call('save');

        self::assertSame('admin', $adminRole->fresh()?->name);
        self::assertTrue($admin->fresh()?->hasRole('admin'));

        // Even outside the panel, a default role cannot be renamed.
        foreach (['admin', 'user', 'guest'] as $name) {
            $role = Role::findByName($name, 'web');
            $role->name = "{$name}-renamed";

            try {
                $role->save();
                self::fail("Default role {$name} was renamed.");
            } catch (\RuntimeException) {
                self::assertSame($name, $role->fresh()?->name);
            }
        }

        $this->actingAs($admin)->get('/admin')->assertOk();
    }

    public function test_custom_roles_can_still_be_renamed(): void
    {
        $admin = $this->createAdmin();
        $role = $this->customRole('auditor');
        $this->actingAs($admin);

        Livewire::test(EditRole::class, ['record' => $role->getRouteKey()])
            ->assertFormFieldIsEnabled('name')
            ->fillForm(['name' => 'auditors'])
            ->call('save')
            ->assertHasNoFormErrors();

        self::assertSame('auditors', $role->fresh()?->name);
        self::assertTrue(AuditLog::query()->where('action', 'admin.role.updated')->where('resource_id', $role->id)->exists());
    }

    public function test_admin_role_keeps_required_admin_permissions(): void
    {
        $admin = $this->createAdmin();
        $adminRole = Role::findByName('admin', 'web');
        $keep = Permission::query()->whereNotIn('name', ['admin.users.manage', 'admin.roles.manage'])->pluck('id')->all();
        $this->actingAs($admin);

        Livewire::test(EditRole::class, ['record' => $adminRole->getRouteKey()])
            ->fillForm(['permissions' => $keep])
            ->call('save');

        $names = $adminRole->fresh()?->permissions()->pluck('name')->all() ?? [];
        self::assertContains('admin.users.manage', $names);
        self::assertContains('admin.roles.manage', $names);
        self::assertFalse(AuditLog::query()->where('action', 'admin.role.updated')->where('resource_id', $adminRole->id)->exists());

        // Removing a non-administrative permission from the admin role is fine.
        $withoutHostDelete = Permission::query()->where('name', '!=', 'hosts.delete')->pluck('id')->all();

        Livewire::test(EditRole::class, ['record' => $adminRole->getRouteKey()])
            ->fillForm(['permissions' => $withoutHostDelete])
            ->call('save')
            ->assertHasNoFormErrors();

        self::assertNotContains('hosts.delete', $adminRole->fresh()?->permissions()->pluck('name')->all() ?? []);
    }

    public function test_demoting_the_last_usable_administrator_is_rejected(): void
    {
        $actingAdmin = $this->createAdmin();
        $otherAdmin = $this->createAdmin();
        $userRole = Role::findByName('user', 'web');
        $this->actingAs($actingAdmin);

        $page = Livewire::test(EditUser::class, ['record' => $otherAdmin->getRouteKey()]);

        // Simulates a concurrent change that suspended the acting admin
        // before this save commits; demoting the other admin would leave no
        // usable administrator.
        $actingAdmin->forceFill(['suspended_at' => now()])->save();

        $page->fillForm(['roles' => [$userRole->id]])->call('save');

        self::assertTrue($otherAdmin->fresh()?->hasRole('admin'));
        self::assertFalse(AuditLog::query()->where('action', 'admin.user.updated')->exists());
    }

    public function test_demoting_an_administrator_is_allowed_while_another_remains(): void
    {
        $actingAdmin = $this->createAdmin();
        $otherAdmin = $this->createAdmin();
        $userRole = Role::findByName('user', 'web');
        $this->actingAs($actingAdmin);

        Livewire::test(EditUser::class, ['record' => $otherAdmin->getRouteKey()])
            ->fillForm(['roles' => [$userRole->id]])
            ->call('save')
            ->assertHasNoFormErrors();

        $otherAdmin->unsetRelation('roles');
        self::assertFalse($otherAdmin->fresh()?->hasRole('admin'));
        self::assertTrue(AuditLog::query()->where('action', 'admin.user.updated')->where('resource_id', $otherAdmin->id)->exists());
    }

    private function assertAuditedOnce(string $action, string $resourceId, User $actor): void
    {
        $logs = AuditLog::query()->where('action', $action)->where('resource_id', $resourceId)->get();

        self::assertCount(1, $logs, "{$action} for {$resourceId}");
        self::assertSame((string) $actor->id, (string) $logs->first()?->actor_user_id);
    }

    private function customRole(string $name): Role
    {
        /** @var Role $role */
        $role = Role::query()->create(['name' => $name, 'guard_name' => 'web']);

        return $role;
    }

    private function createAdmin(): User
    {
        /** @var User $user */
        $user = User::factory()->create([
            'two_fa_enabled_at' => now(),
            'two_fa_secret_enc' => 'TESTTOTPSECRET',
        ]);
        $user->assignRole(['admin', 'user']);

        return $user;
    }
}
