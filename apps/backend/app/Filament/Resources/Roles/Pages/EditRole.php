<?php

declare(strict_types=1);

namespace App\Filament\Resources\Roles\Pages;

use App\Filament\Concerns\GuardsAdministratorAccess;
use App\Filament\Resources\Roles\RoleResource;
use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use App\Services\RoleAdministrationService;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditRole extends EditRecord
{
    use GuardsAdministratorAccess;

    protected static string $resource = RoleResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make()
                ->visible(fn (Role $record): bool => ! $record->isDefault())
                ->using(fn (Role $record, RoleAdministrationService $roles): bool => $roles->delete(
                    auth()->user() instanceof User ? auth()->user() : null,
                    $record,
                )),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function mutateFormDataBeforeSave(array $data): array
    {
        // Default role names are immutable; the field is disabled in the
        // form, and this drops any submitted value regardless.
        if ($this->record instanceof Role && $this->record->isDefault()) {
            unset($data['name'], $data['guard_name']);
        }

        return $data;
    }

    protected function afterSave(): void
    {
        $this->ensureAdministrable();

        if (! $this->record instanceof Role) {
            return;
        }

        AuditLog::record(
            actor: auth()->user() instanceof User ? auth()->user() : null,
            action: 'admin.role.updated',
            resourceType: 'role',
            resourceId: (string) $this->record->id,
            metadata: [
                'name' => (string) $this->record->name,
                'permissions' => $this->record->permissions()->pluck('name')->sort()->values()->all(),
            ],
        );
    }
}
