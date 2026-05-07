<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\SystemController;
use Illuminate\Support\Facades\Route;

Route::get('/server-info', [SystemController::class, 'serverInfo']);
Route::get('/health', [SystemController::class, 'health']);

Route::prefix('v1')->group(__DIR__.'/api_v1.php');
