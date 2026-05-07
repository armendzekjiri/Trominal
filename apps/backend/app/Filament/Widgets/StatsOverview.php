<?php

declare(strict_types=1);

namespace App\Filament\Widgets;

use App\Models\AuditLog;
use App\Models\RefreshToken;
use App\Models\User;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class StatsOverview extends StatsOverviewWidget
{
    /**
     * @return array<Stat>
     */
    protected function getStats(): array
    {
        return [
            Stat::make('Total users', (string) User::query()->count()),
            Stat::make('Active sessions', (string) RefreshToken::query()
                ->whereNull('revoked_at')
                ->whereNull('rotated_at')
                ->where('expires_at', '>', now())
                ->count()),
            Stat::make('Registrations this week', (string) User::query()
                ->where('created_at', '>=', now()->startOfWeek())
                ->count()),
            Stat::make('Audit events today', (string) AuditLog::query()
                ->where('created_at', '>=', now()->startOfDay())
                ->count()),
        ];
    }
}
