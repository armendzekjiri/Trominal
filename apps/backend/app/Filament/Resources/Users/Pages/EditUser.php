<?php

declare(strict_types=1);

namespace App\Filament\Resources\Users\Pages;

use App\Filament\Concerns\GuardsAdministratorAccess;
use App\Filament\Resources\Users\UserResource;
use App\Models\AuditLog;
use App\Models\User;
use Filament\Resources\Pages\EditRecord;

class EditUser extends EditRecord
{
    use GuardsAdministratorAccess;

    protected static string $resource = UserResource::class;

    protected function afterSave(): void
    {
        $this->ensureAdministrable();

        if (! $this->record instanceof User) {
            return;
        }

        AuditLog::record(
            actor: auth()->user() instanceof User ? auth()->user() : null,
            action: 'admin.user.updated',
            resourceType: 'user',
            resourceId: (string) $this->record->id,
            metadata: [
                'roles' => $this->record->roles()->pluck('name')->sort()->values()->all(),
            ],
        );
    }
}
