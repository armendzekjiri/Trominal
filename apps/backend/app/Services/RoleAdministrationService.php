<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Admin-panel role mutations that must stay atomic with their audit entry.
 */
final class RoleAdministrationService
{
    /**
     * Delete a custom role. Default roles are never deleted.
     *
     * @return bool whether the role was deleted
     */
    public function delete(?User $actor, Role $role): bool
    {
        if ($role->isDefault()) {
            return false;
        }

        return DB::transaction(function () use ($actor, $role): bool {
            $roleId = (string) $role->getKey();
            $roleName = (string) $role->name;

            if (! (bool) $role->delete()) {
                return false;
            }

            AuditLog::record($actor, 'admin.role.deleted', 'role', $roleId, [
                'name' => $roleName,
            ]);

            return true;
        });
    }
}
