<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Requests\Api\V1\Auth\ForgotPasswordRequest;
use App\Http\Requests\Api\V1\Auth\LoginRequest;
use App\Http\Requests\Api\V1\Auth\RefreshTokenRequest;
use App\Http\Requests\Api\V1\Auth\RegisterRequest;
use App\Http\Requests\Api\V1\Auth\ResetPasswordRequest;
use App\Http\Resources\Api\V1\UserResource;
use App\Models\User;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

final class AuthController extends Controller
{
    public function __construct(private readonly AuthService $authService) {}

    public function register(RegisterRequest $request): JsonResponse
    {
        $tokenPair = $this->authService->register($request->validated());

        return $this->tokenResponse($tokenPair, 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $tokenPair = $this->authService->login($request->validated());

        return $this->tokenResponse($tokenPair);
    }

    public function refresh(RefreshTokenRequest $request): JsonResponse
    {
        $tokenPair = $this->authService->refresh($request->validated());

        return $this->tokenResponse($tokenPair);
    }

    public function logout(Request $request): JsonResponse
    {
        $this->authService->logout($this->currentUser($request), $request->bearerToken());

        return response()->json(['message' => 'Logged out.']);
    }

    public function me(Request $request): UserResource
    {
        return new UserResource($this->currentUser($request)->load(['roles', 'permissions']));
    }

    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $this->authService->sendPasswordResetLink((string) $request->validated('email'));

        return response()->json(['message' => 'If the account exists, a reset link has been sent.'], 202);
    }

    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $this->authService->resetPassword(
            (string) $request->validated('email'),
            (string) $request->validated('token'),
            (string) $request->validated('password'),
        );

        return response()->json(['message' => 'Password reset.']);
    }

    /**
     * @param  array{user: User, access_token: string, refresh_token: string, token_type: string, expires_in: int}  $tokenPair
     */
    private function tokenResponse(array $tokenPair, int $status = 200): JsonResponse
    {
        return response()->json([
            'user' => new UserResource($tokenPair['user']),
            'access_token' => $tokenPair['access_token'],
            'refresh_token' => $tokenPair['refresh_token'],
            'token_type' => $tokenPair['token_type'],
            'expires_in' => $tokenPair['expires_in'],
        ], $status);
    }

    private function currentUser(Request $request): User
    {
        $user = $request->user();

        abort_unless($user instanceof User, 401);

        return $user;
    }
}
