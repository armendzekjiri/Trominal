<?php

declare(strict_types=1);

namespace App\Filament\Concerns;

use App\Exceptions\AdminLockoutException;
use App\Services\AdminAccessGuard;
use Filament\Notifications\Notification;
use Filament\Support\Exceptions\Halt;

/**
 * For Filament edit pages whose save can affect administrator access.
 *
 * The page saves inside a database transaction; beforeSave() takes the admin
 * lock before relationships (roles, permissions) are written, and
 * ensureAdministrable() — call it first in afterSave() — rolls the whole
 * save back when it would lock administrators out.
 */
trait GuardsAdministratorAccess
{
    public function hasDatabaseTransactions(): bool
    {
        return true;
    }

    protected function beforeSave(): void
    {
        app(AdminAccessGuard::class)->lock();
    }

    /**
     * @throws Halt
     */
    protected function ensureAdministrable(): void
    {
        try {
            app(AdminAccessGuard::class)->assertAdministrable();
        } catch (AdminLockoutException $exception) {
            Notification::make()
                ->danger()
                ->title(__('Change not saved'))
                ->body($exception->getMessage())
                ->send();

            throw (new Halt)->rollBackDatabaseTransaction();
        }
    }
}
