<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Filament\Resources\AuditLogs\AuditLogResource;
use App\Filament\Resources\Permissions\PermissionResource;
use App\Filament\Resources\Users\UserResource;
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
}
