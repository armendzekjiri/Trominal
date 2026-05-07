<?php

declare(strict_types=1);

namespace App\Filament\Resources\Invites\Pages;

use App\Filament\Resources\Invites\InviteResource;
use App\Models\AuditLog;
use App\Models\Invite;
use App\Models\User;
use Filament\Resources\Pages\EditRecord;

class EditInvite extends EditRecord
{
    protected static string $resource = InviteResource::class;

    protected function afterSave(): void
    {
        if (! $this->record instanceof Invite) {
            return;
        }

        AuditLog::record(
            actor: auth()->user() instanceof User ? auth()->user() : null,
            action: 'admin.invite.updated',
            resourceType: 'invite',
            resourceId: (string) $this->record->id,
        );
    }
}
