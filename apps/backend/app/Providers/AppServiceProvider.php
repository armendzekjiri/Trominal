<?php

declare(strict_types=1);

namespace App\Providers;

use App\Models\AiSetting;
use App\Models\Group;
use App\Models\Host;
use App\Models\HostCredential;
use App\Models\Identity;
use App\Models\PersonalAccessToken;
use App\Models\Snippet;
use App\Models\Tunnel;
use App\Policies\VaultRecordPolicy;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Sanctum::usePersonalAccessTokenModel(PersonalAccessToken::class);

        foreach ([AiSetting::class, Group::class, Host::class, HostCredential::class, Identity::class, Snippet::class, Tunnel::class] as $model) {
            Gate::policy($model, VaultRecordPolicy::class);
        }

        RateLimiter::for('auth', function (Request $request): Limit {
            return Limit::perMinute(10)->by($request->ip() ?? 'unknown');
        });
    }
}
