<?php

declare(strict_types=1);

namespace App\Filament\Resources\Invites\Pages;

use App\Filament\Resources\Invites\InviteResource;
use App\Models\AuditLog;
use App\Models\Invite;
use App\Models\User;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Support\Str;

class CreateInvite extends CreateRecord
{
    protected static string $resource = InviteResource::class;

    private string $plainInviteCode;

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function mutateFormDataBeforeCreate(array $data): array
    {
        $this->plainInviteCode = Str::random(40);

        return [
            ...$data,
            'created_by_user_id' => auth()->id(),
            'code_hash' => hash('sha256', $this->plainInviteCode),
        ];
    }

    protected function afterCreate(): void
    {
        /** @var Invite $invite */
        $invite = $this->record;

        AuditLog::record(
            actor: auth()->user() instanceof User ? auth()->user() : null,
            action: 'admin.invite.created',
            resourceType: 'invite',
            resourceId: (string) $invite->id,
            metadata: [
                'email' => $invite->email,
                'expires_at' => $invite->expires_at?->toIso8601String(),
            ],
        );

        Notification::make()
            ->success()
            ->title('Invite created')
            ->body('Invite code: '.$this->plainInviteCode)
            ->persistent()
            ->send();
    }
}
