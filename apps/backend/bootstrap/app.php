<?php

declare(strict_types=1);

use App\Http\Middleware\EnsureUserIsNotSuspended;
use App\Http\Middleware\RecordAuditLog;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\HandleCors;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Trominal's API serves a separate-origin client (Tauri/Vite/web).
        // Laravel 11+ ships HandleCors but doesn't enable it by default —
        // wire it for the API surface only. Origins are env-driven via
        // ALLOWED_ORIGINS (see config/cors.php).
        $middleware->prepend(HandleCors::class);

        $middleware->alias([
            'audit' => RecordAuditLog::class,
            'not_suspended' => EnsureUserIsNotSuspended::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
