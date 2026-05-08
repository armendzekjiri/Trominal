<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;
use Spatie\Permission\PermissionRegistrar;

final class RoleAndPermissionSeeder extends Seeder
{
    /** @var list<string> */
    private const array USER_PERMISSIONS = [
        'hosts.create',
        'hosts.read',
        'hosts.update',
        'hosts.delete',
        'hosts.connect',
        'snippets.create',
        'snippets.read',
        'snippets.update',
        'snippets.delete',
        'identities.create',
        'identities.read',
        'identities.update',
        'identities.delete',
        'tunnels.create',
        'tunnels.read',
        'tunnels.update',
        'tunnels.delete',
        'sftp.connect',
        'sftp.read',
        'sftp.upload',
        'sftp.download',
        'sftp.delete',
        'ai.use',
        'audit.read.own',
        'teams.create',
        'teams.read.own',
        'teams.update.own',
        'teams.delete.own',
        'teams.members.invite',
        'teams.members.remove',
        'teams.roles.assign',
    ];

    /** @var list<string> */
    private const array GUEST_PERMISSIONS = [
        'hosts.read',
        'snippets.read',
    ];

    /** @var list<string> */
    private const array ADMIN_PERMISSIONS = [
        'admin.users.manage',
        'admin.teams.manage',
        'admin.roles.manage',
        'admin.permissions.manage',
        'admin.settings.manage',
        'admin.audit.read.all',
        'admin.invites.manage',
    ];

    /**
     * Seed roles and permissions.
     */
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $allPermissions = array_values(array_unique([
            ...self::USER_PERMISSIONS,
            ...self::GUEST_PERMISSIONS,
            ...self::ADMIN_PERMISSIONS,
        ]));

        foreach ($allPermissions as $permissionName) {
            Permission::query()->firstOrCreate([
                'name' => $permissionName,
                'guard_name' => 'web',
            ]);
        }

        $admin = Role::query()->firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $user = Role::query()->firstOrCreate(['name' => 'user', 'guard_name' => 'web']);
        $guest = Role::query()->firstOrCreate(['name' => 'guest', 'guard_name' => 'web']);

        $admin->syncPermissions($allPermissions);
        $user->syncPermissions(self::USER_PERMISSIONS);
        $guest->syncPermissions(self::GUEST_PERMISSIONS);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
