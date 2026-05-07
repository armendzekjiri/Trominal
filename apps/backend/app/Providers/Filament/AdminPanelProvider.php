<?php

declare(strict_types=1);

namespace App\Providers\Filament;

use App\Filament\Widgets\RecentAudit;
use App\Filament\Widgets\RecentRegistrations;
use App\Filament\Widgets\StatsOverview;
use App\Http\Middleware\EnsureAdminPanelAccess;
use Filament\Auth\MultiFactor\App\AppAuthentication;
use Filament\Http\Middleware\Authenticate;
use Filament\Http\Middleware\AuthenticateSession;
use Filament\Http\Middleware\DisableBladeIconComponents;
use Filament\Http\Middleware\DispatchServingFilamentEvent;
use Filament\Pages\Dashboard;
use Filament\Panel;
use Filament\PanelProvider;
use Filament\Support\Colors\Color;
use Filament\Widgets\AccountWidget;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\View\Middleware\ShareErrorsFromSession;

class AdminPanelProvider extends PanelProvider
{
    public function panel(Panel $panel): Panel
    {
        return $panel
            ->default()
            ->id('admin')
            ->path('admin')
            ->brandName('Trominal')
            ->login()
            // No Filament-side registration: the first user must sign up
            // through the client app at `/register`, where they pick a master
            // password and we generate real vault material. Filament-driven
            // signup would have to fake those columns and the resulting user
            // could never unlock their vault. Subsequent users are created
            // either by an admin via Filament UserResource or via API invites.
            ->profile()
            ->multiFactorAuthentication([
                AppAuthentication::make()
                    ->brandName('Trominal'),
            ], isRequired: true)
            ->colors([
                'primary' => Color::Sky,
            ])
            ->discoverResources(in: app_path('Filament/Resources'), for: 'App\Filament\Resources')
            ->discoverPages(in: app_path('Filament/Pages'), for: 'App\Filament\Pages')
            ->pages([
                Dashboard::class,
            ])
            ->discoverWidgets(in: app_path('Filament/Widgets'), for: 'App\Filament\Widgets')
            ->widgets([
                AccountWidget::class,
                StatsOverview::class,
                RecentRegistrations::class,
                RecentAudit::class,
            ])
            ->middleware([
                EncryptCookies::class,
                AddQueuedCookiesToResponse::class,
                StartSession::class,
                AuthenticateSession::class,
                ShareErrorsFromSession::class,
                PreventRequestForgery::class,
                SubstituteBindings::class,
                DisableBladeIconComponents::class,
                DispatchServingFilamentEvent::class,
            ])
            ->authMiddleware([
                Authenticate::class,
                EnsureAdminPanelAccess::class,
            ]);
    }
}
