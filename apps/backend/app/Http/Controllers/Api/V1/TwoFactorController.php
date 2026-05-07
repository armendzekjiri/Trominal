<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Requests\Api\V1\Auth\TwoFactorDisableRequest;
use App\Http\Requests\Api\V1\Auth\TwoFactorVerifyRequest;
use App\Models\User;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

final class TwoFactorController extends Controller
{
    public function __construct(private readonly AuthService $authService) {}

    public function enable(Request $request): JsonResponse
    {
        return response()->json($this->authService->enableTwoFactor($this->currentUser($request)));
    }

    public function verify(TwoFactorVerifyRequest $request): JsonResponse
    {
        $this->authService->verifyTwoFactor(
            $this->currentUser($request),
            (string) $request->validated('code'),
        );

        return response()->json(['message' => 'Two-factor authentication enabled.']);
    }

    public function disable(TwoFactorDisableRequest $request): JsonResponse
    {
        $this->authService->disableTwoFactor(
            $this->currentUser($request),
            (string) $request->validated('password'),
            (string) $request->validated('code'),
        );

        return response()->json(['message' => 'Two-factor authentication disabled.']);
    }

    private function currentUser(Request $request): User
    {
        $user = $request->user();

        abort_unless($user instanceof User, 401);

        return $user;
    }
}
