<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Filament\Resources\Roles\Pages\EditRole;
use App\Filament\Resources\Roles\Pages\ListRoles;
use App\Models\AuditLog;
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
