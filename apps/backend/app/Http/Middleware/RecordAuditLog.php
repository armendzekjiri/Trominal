<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\AuditLog;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class RecordAuditLog
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next, string $action): Response
    {
        $response = $next($request);

        if ($response->getStatusCode() < 400) {
            $user = $request->user();

            AuditLog::record($user instanceof User ? $user : null, $action, 'user', $user?->id);
        }

        return $response;
    }
}
