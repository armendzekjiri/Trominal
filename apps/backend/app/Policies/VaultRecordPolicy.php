<?php

declare(strict_types=1);

namespace App\Policies;

use App\Enums\TeamAction;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * Record-level authorization for vault resources.
 *
 * Personal records are only reachable by their owner. Team-scoped records
 * are authorized against the caller's team role (App\Enums\TeamRole); team
 * record creation is checked in VaultResourceController::store. These
 * checks run in addition to the global Spatie permission enforced by the
 * route middleware; neither replaces the other.
 */
final class VaultRecordPolicy
{
    public function view(User $user, Model $record): bool
    {
        return $this->allows($user, $record, TeamAction::ReadRecords);
    }

    public function update(User $user, Model $record): bool
    {
        return $this->allows($user, $record, TeamAction::UpdateRecords);
    }

    public function delete(User $user, Model $record): bool
    {
        return $this->allows($user, $record, TeamAction::DeleteRecords);
    }

    public function connect(User $user, Model $record): bool
    {
        return $this->allows($user, $record, TeamAction::ConnectHosts);
    }

    private function allows(User $user, Model $record, TeamAction $action): bool
    {
        $teamId = $record->getAttribute('team_id');

        if (is_string($teamId) && $teamId !== '') {
            return TeamMember::forUser($user, $teamId)?->allows($action) ?? false;
        }

        return (string) $record->getAttribute('user_id') === (string) $user->id;
    }
}
