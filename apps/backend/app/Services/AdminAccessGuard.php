<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\AdminLockoutException;
use App\Models\Role;
use App\Models\User;

/**
 * Keeps the instance administrable.
 *
 * Every admin-panel change that can affect administrator access (user role
 * changes, suspension, admin-role permission edits) must, inside one
 * database transaction:
 *
 *   1. call lock() before changing anything — this serializes concurrent
 *      admin-affecting changes on the admin role row;
 *   2. apply the change;
 *   3. call assertAdministrable() — throwing rolls the transaction back.
 */
final class AdminAccessGuard
{
    /**
     * Permissions the default admin role must always hold so that admins can
     * still reach and repair users, roles and settings.
     *
     * @var list<string>
     */
    public const array REQUIRED_ADMIN_PERMISSIONS = [
        'admin.users.manage',
        'admin.teams.manage',
        'admin.roles.manage',
        'admin.permissions.manage',
        'admin.settings.manage',
        'admin.audit.read.all',
        'admin.invites.manage',
    ];

    public function lock(): void
    {
        Role::query()
            ->where('name', Role::ADMIN)
            ->where('guard_name', 'web')
            ->lockForUpdate()
            ->first();
    }

    /**
     * Users who can currently use the admin panel: admin role, not
     * suspended, not deleted.
     */
    public function usableAdminCount(): int
    {
        return User::query()
            ->whereNull('suspended_at')
            ->whereHas('roles', fn ($query) => $query->where('name', Role::ADMIN))
            ->count();
    }

    /**
     * @throws AdminLockoutException
     */
    public function assertAdministrable(): void
    {
        /** @var Role|null $adminRole */
        $adminRole = Role::query()->where('name', Role::ADMIN)->where('guard_name', 'web')->first();

        if (! $adminRole instanceof Role) {
            throw new AdminLockoutException(__('The default admin role cannot be removed or renamed.'));
        }

        $granted = $adminRole->permissions()->pluck('name')->all();
        $missing = array_values(array_diff(self::REQUIRED_ADMIN_PERMISSIONS, $granted));

        if ($missing !== []) {
            throw new AdminLockoutException(__('The admin role must keep these permissions: :permissions.', [
                'permissions' => implode(', ', $missing),
            ]));
        }

        if ($this->usableAdminCount() < 1) {
            throw new AdminLockoutException(__('At least one active administrator must remain.'));
        }
    }
}
