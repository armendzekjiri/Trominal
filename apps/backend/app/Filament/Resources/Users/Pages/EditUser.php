<?php

declare(strict_types=1);

namespace App\Filament\Resources\Users\Pages;

use App\Filament\Concerns\GuardsAdministratorAccess;
use App\Filament\Resources\Users\UserResource;
use App\Models\AuditLog;
use App\Models\User;
use App\Services\UserSuspensionService;
use Filament\Resources\Pages\EditRecord;

class EditUser extends EditRecord
{
    use GuardsAdministratorAccess;

    protected static string $resource = UserResource::class;

    /**
     * Requested suspension state from the form; null when the field was not
     * submitted (e.g. disabled for the admin's own account).
     */
    private ?bool $requestedSuspension = null;

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function mutateFormDataBeforeFill(array $data): array
    {
        $data['suspended'] = ($data['suspended_at'] ?? null) !== null;

        return $data;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function mutateFormDataBeforeSave(array $data): array
    {
        $this->requestedSuspension = array_key_exists('suspended', $data) ? (bool) $data['suspended'] : null;

        // Suspension is never written as a plain attribute; see afterSave().
        unset($data['suspended'], $data['suspended_at']);

        return $data;
    }

    protected function afterSave(): void
    {
        $user = $this->record;

        if (! $user instanceof User) {
            return;
        }

        $this->applySuspensionChange($user);
        $this->ensureAdministrable();

        AuditLog::record(
            actor: $this->actor(),
            action: 'admin.user.updated',
            resourceType: 'user',
            resourceId: (string) $user->id,
            metadata: [
                'roles' => $user->roles()->pluck('name')->sort()->values()->all(),
            ],
        );
    }

    private function applySuspensionChange(User $user): void
    {
        $isSuspended = $user->suspended_at !== null;

        if ($this->requestedSuspension === null || $this->requestedSuspension === $isSuspended) {
            return;
        }

        $suspensions = app(UserSuspensionService::class);

        $this->haltOnLockout(fn () => $this->requestedSuspension
            ? $suspensions->suspend($this->actor(), $user)
            : $suspensions->unsuspend($this->actor(), $user));
    }

    private function actor(): ?User
    {
        $user = auth()->user();

        return $user instanceof User ? $user : null;
    }
}
