<?php

declare(strict_types=1);

namespace App\Models;

use App\Exceptions\AdminLockoutException;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Spatie\Permission\Models\Role as SpatieRole;

final class Role extends SpatieRole
{
    use HasUlids;

    public const string ADMIN = 'admin';

    /**
     * Seeded roles the application depends on by name (panel access checks
     * `hasRole('admin')`, registration assigns `user`). They can be edited
     * but never renamed or deleted.
     *
     * @var list<string>
     */
    public const array DEFAULT_ROLES = [self::ADMIN, 'user', 'guest'];

    public function isDefault(): bool
    {
        return in_array($this->getOriginal('name') ?? $this->name, self::DEFAULT_ROLES, true);
    }

    protected static function booted(): void
    {
        self::updating(static function (self $role): void {
            if ($role->isDefault() && ($role->isDirty('name') || $role->isDirty('guard_name'))) {
                throw new AdminLockoutException(__('Default roles cannot be renamed.'));
            }
        });

        self::deleting(static function (self $role): void {
            if ($role->isDefault()) {
                throw new AdminLockoutException(__('Default roles cannot be deleted.'));
            }
        });
    }
}
