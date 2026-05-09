<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

final class VaultRecordPolicy
{
    public function view(User $user, Model $record): bool
    {
        return $this->owns($user, $record);
    }

    public function update(User $user, Model $record): bool
    {
        return $this->owns($user, $record);
    }

    public function delete(User $user, Model $record): bool
    {
        return $this->owns($user, $record);
    }

    private function owns(User $user, Model $record): bool
    {
        $teamId = $record->getAttribute('team_id');

        if (is_string($teamId) && $teamId !== '') {
            return TeamMember::query()
                ->where('team_id', $teamId)
                ->where('user_id', $user->id)
                ->exists();
        }

        return (string) $record->getAttribute('user_id') === (string) $user->id;
    }
}
