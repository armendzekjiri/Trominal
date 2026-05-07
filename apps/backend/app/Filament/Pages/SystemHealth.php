<?php

declare(strict_types=1);

namespace App\Filament\Pages;

use BackedEnum;
use Filament\Pages\Page;
use Filament\Support\Icons\Heroicon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Throwable;
use UnitEnum;

class SystemHealth extends Page
{
    protected string $view = 'filament.pages.system-health';

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    protected static string|UnitEnum|null $navigationGroup = 'Operations';

    public static function canAccess(): bool
    {
        return auth()->user()?->can('admin.settings.manage') ?? false;
    }

    /**
     * @return array<string, string|bool>
     */
    public function health(): array
    {
        return [
            'database' => $this->databaseIsHealthy(),
            'redis' => $this->redisIsHealthy(),
            'queue_connection' => (string) config('queue.default'),
            'cache_store' => (string) config('cache.default'),
            'app_env' => (string) config('app.env'),
        ];
    }

    private function databaseIsHealthy(): bool
    {
        try {
            DB::select('select 1');

            return true;
        } catch (Throwable) {
            return false;
        }
    }

    private function redisIsHealthy(): bool
    {
        try {
            Redis::connection()->ping();

            return true;
        } catch (Throwable) {
            return false;
        }
    }
}
