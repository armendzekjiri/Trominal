<?php

declare(strict_types=1);

namespace App\Filament\Resources\Roles\Pages;

use App\Filament\Resources\Roles\RoleResource;
use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditRole extends EditRecord
{
    protected static string $resource = RoleResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make()
                ->visible(fn (Role $record): bool => ! in_array($record->name, ['admin', 'user', 'guest'], true))
                ->after(function (Role $record): void {
                    AuditLog::record(
                        actor: auth()->user() instanceof User ? auth()->user() : null,
                        action: 'admin.role.deleted',
                        resourceType: 'role',
                        resourceId: (string) $record->id,
                    );
                }),
        ];
    }

    protected function afterSave(): void
    {
        if (! $this->record instanceof Role) {
            return;
        }

        AuditLog::record(
            actor: auth()->user() instanceof User ? auth()->user() : null,
            action: 'admin.role.updated',
            resourceType: 'role',
            resourceId: (string) $this->record->id,
        );
    }
}
