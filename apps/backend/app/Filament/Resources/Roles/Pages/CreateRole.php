<?php

declare(strict_types=1);

namespace App\Filament\Resources\Roles\Pages;

use App\Filament\Resources\Roles\RoleResource;
use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use Filament\Resources\Pages\CreateRecord;

class CreateRole extends CreateRecord
{
    protected static string $resource = RoleResource::class;

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function mutateFormDataBeforeCreate(array $data): array
    {
        $data['guard_name'] = 'web';

        return $data;
    }

    protected function afterCreate(): void
    {
        /** @var Role $role */
        $role = $this->record;

        AuditLog::record(
            actor: auth()->user() instanceof User ? auth()->user() : null,
            action: 'admin.role.created',
            resourceType: 'role',
            resourceId: (string) $role->id,
        );
    }
}
