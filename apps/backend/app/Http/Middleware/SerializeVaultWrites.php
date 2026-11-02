<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\PersonalAccessToken;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Serializes vault writes against master-password rotation.
 *
 * Each write takes the same user-row lock the rotation takes first, then
 * re-checks that its access token still exists. A write that was already in
 * flight when another device rotated the vault key therefore fails instead of
 * storing ciphertext made with the previous key.
 */
final class SerializeVaultWrites
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return $next($request);
        }

        DB::beginTransaction();

        try {
            User::query()->whereKey($user->id)->lockForUpdate()->first();

            $token = $user->currentAccessToken();

            if ($token instanceof PersonalAccessToken && ! PersonalAccessToken::query()->whereKey($token->getKey())->exists()) {
                DB::rollBack();

                return response()->json(['message' => __('Unauthenticated.')], 401);
            }

            // The router renders exceptions into responses, so roll back on
            // any error status rather than only on a thrown exception.
            $response = $next($request);

            if ($response->getStatusCode() >= 400) {
                DB::rollBack();
            } else {
                DB::commit();
            }

            return $response;
        } catch (Throwable $exception) {
            DB::rollBack();

            throw $exception;
        }
    }
}
