<?php

declare(strict_types=1);

namespace App\Policies;

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
        return (string) $record->getAttribute('user_id') === (string) $user->id;
    }
}
