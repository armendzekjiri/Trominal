<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\MasterPasswordController;
use App\Http\Controllers\Api\V1\SshTokenController;
use App\Http\Controllers\Api\V1\TeamController;
use App\Http\Controllers\Api\V1\TeamMemberController;
use App\Http\Controllers\Api\V1\TwoFactorController;
use App\Http\Controllers\Api\V1\VaultResourceController;
use App\Http\Controllers\Api\V1\VaultSyncController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->middleware('throttle:auth')->group(function (): void {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/refresh', [AuthController::class, 'refresh']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
});

Route::middleware(['auth:sanctum', 'not_suspended'])->group(function (): void {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/me/master-password/change', [MasterPasswordController::class, 'update']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::prefix('auth/two-factor')->group(function (): void {
        Route::post('/enable', [TwoFactorController::class, 'enable']);
        Route::post('/verify', [TwoFactorController::class, 'verify']);
        Route::post('/disable', [TwoFactorController::class, 'disable']);
    });

    Route::get('/vault/sync', VaultSyncController::class);
    Route::post('/ws/ssh-token', [SshTokenController::class, 'store'])
        ->middleware('can:hosts.connect');

    Route::get('/teams/users/lookup', [TeamController::class, 'lookupUser'])
        ->middleware('can:teams.members.invite');
    Route::get('/teams', [TeamController::class, 'index'])
        ->middleware('can:teams.read.own');
    Route::post('/teams', [TeamController::class, 'store'])
        ->middleware('can:teams.create');
    Route::get('/teams/{team}', [TeamController::class, 'show'])
        ->middleware('can:teams.read.own');
    Route::patch('/teams/{team}', [TeamController::class, 'update'])
        ->middleware('can:teams.update.own');
    Route::delete('/teams/{team}', [TeamController::class, 'destroy'])
        ->middleware('can:teams.delete.own');
    Route::get('/teams/{team}/members', [TeamMemberController::class, 'index'])
        ->middleware('can:teams.read.own');
    Route::post('/teams/{team}/members', [TeamMemberController::class, 'store'])
        ->middleware('can:teams.members.invite');
    Route::patch('/teams/{team}/members/{member}', [TeamMemberController::class, 'update'])
        ->middleware('can:teams.roles.assign');
    Route::delete('/teams/{team}/members/{member}', [TeamMemberController::class, 'destroy'])
        ->middleware('can:teams.members.remove');

    foreach ([
        'groups' => ['read' => 'hosts.read', 'create' => 'hosts.create', 'update' => 'hosts.update', 'delete' => 'hosts.delete'],
        'hosts' => ['read' => 'hosts.read', 'create' => 'hosts.create', 'update' => 'hosts.update', 'delete' => 'hosts.delete'],
        'host-credentials' => ['read' => 'hosts.read', 'create' => 'hosts.create', 'update' => 'hosts.update', 'delete' => 'hosts.delete'],
        'snippets' => ['read' => 'snippets.read', 'create' => 'snippets.create', 'update' => 'snippets.update', 'delete' => 'snippets.delete'],
        'identities' => ['read' => 'identities.read', 'create' => 'identities.create', 'update' => 'identities.update', 'delete' => 'identities.delete'],
        'tunnels' => ['read' => 'tunnels.read', 'create' => 'tunnels.create', 'update' => 'tunnels.update', 'delete' => 'tunnels.delete'],
        'ai-settings' => ['read' => 'ai.use', 'create' => 'ai.use', 'update' => 'ai.use', 'delete' => 'ai.use'],
    ] as $vaultType => $permissions) {
        Route::get("/vault/{$vaultType}", [VaultResourceController::class, 'index'])
            ->defaults('vaultType', $vaultType)
            ->middleware("can:{$permissions['read']}");
        Route::post("/vault/{$vaultType}", [VaultResourceController::class, 'store'])
            ->defaults('vaultType', $vaultType)
            ->middleware("can:{$permissions['create']}");
        Route::get("/vault/{$vaultType}/{record}", [VaultResourceController::class, 'show'])
            ->defaults('vaultType', $vaultType)
            ->middleware("can:{$permissions['read']}");
        Route::patch("/vault/{$vaultType}/{record}", [VaultResourceController::class, 'update'])
            ->defaults('vaultType', $vaultType)
            ->middleware("can:{$permissions['update']}");
        Route::delete("/vault/{$vaultType}/{record}", [VaultResourceController::class, 'destroy'])
            ->defaults('vaultType', $vaultType)
            ->middleware("can:{$permissions['delete']}");
    }
});
