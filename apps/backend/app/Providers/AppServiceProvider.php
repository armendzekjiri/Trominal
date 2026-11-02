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

        // Unauthenticated auth endpoints, per IP. Failed sign-ins are further
        // limited per account and per IP by App\Services\LoginRateLimiter,
        // and refreshes per account inside AuthService::refresh().
        RateLimiter::for('auth', function (Request $request): Limit {
            return Limit::perMinute(10)->by($request->ip() ?? 'unknown');
        });

        // Authenticated /auth/two-factor/* routes, per account and per IP.
        // Failed codes are additionally bounded by TwoFactorCodeVerifier.
        RateLimiter::for('two-factor', function (Request $request): array {
            $perMinute = max(1, (int) config('trominal.rate_limits.two_factor_requests_per_minute', 10));
            $userKey = $request->user()?->getAuthIdentifier();

            return [
                Limit::perMinute($perMinute)->by('two-factor:user:'.(is_scalar($userKey) ? (string) $userKey : 'guest')),
                Limit::perMinute($perMinute * 3)->by('two-factor:ip:'.($request->ip() ?? 'unknown')),
            ];
        });
    }
}
