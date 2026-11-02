<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\MasterPasswordChangeRequest;
use App\Http\Requests\Api\V1\PrivateKeyRebindRequest;
use App\Http\Resources\Api\V1\UserResource;
use App\Models\PersonalAccessToken;
use App\Models\User;
use App\Services\VaultRotationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class MasterPasswordController extends Controller
{
    public function __construct(private readonly VaultRotationService $rotation) {}

    public function update(MasterPasswordChangeRequest $request): JsonResponse
    {
        $user = $this->rotation->rotateMasterPassword(
            $this->user($request),
            $this->currentAccessToken($request),
            $request->payload(),
        );

        return $this->materialResponse($user);
    }

    public function rebindPrivateKey(PrivateKeyRebindRequest $request): JsonResponse
    {
        $user = $this->rotation->rebindPrivateKey(
            $this->user($request),
            (int) $request->validated('vault_version'),
            (string) $request->validated('private_key_ciphertext'),
            (string) $request->validated('private_key_nonce'),
        );

        return $this->materialResponse($user);
    }

    private function materialResponse(User $user): JsonResponse
    {
        return response()->json([
            'vault_version' => $user->vault_version,
            'vault' => UserResource::vaultMaterial($user),
        ]);
    }

    private function user(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }

    private function currentAccessToken(Request $request): ?PersonalAccessToken
    {
        $token = $this->user($request)->currentAccessToken();

        return $token instanceof PersonalAccessToken ? $token : null;
    }
}
