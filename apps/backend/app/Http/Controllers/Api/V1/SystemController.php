<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Models\AppSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Throwable;

final class SystemController extends Controller
{
    public function serverInfo(): JsonResponse
    {
        $registration = AppSetting::registration()->value;

        return response()->json([
            'instance_name' => $registration['instance_name'] ?? 'Trominal',
            'backend_version' => config('trominal.backend_version'),
            'api_version' => config('trominal.api_version'),
            'min_client_version' => config('trominal.min_client_version'),
            'registration_mode' => $registration['mode'] ?? 'single',
            'registration_open' => (bool) ($registration['open'] ?? false),
            'web_ssh_enabled' => (bool) ($registration['web_ssh_enabled'] ?? true),
        ]);
    }

    public function health(): JsonResponse
    {
        return response()->json([
            'status' => 'ok',
            'database' => $this->databaseIsHealthy(),
            'redis' => $this->redisIsHealthy(),
        ]);
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
            return Redis::connection()->ping() !== false;
        } catch (Throwable) {
            return false;
        }
    }
}
