<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\MasterPasswordChangeRequest;
use App\Models\AuditLog;
use App\Models\RefreshToken;
use App\Models\User;
use App\Support\Vault\VaultResourceRegistry;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class MasterPasswordController extends Controller
{
    public function update(MasterPasswordChangeRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $payload = $request->payload();

        DB::transaction(function () use ($payload, $user): void {
            foreach ($payload['items'] as $item) {
                $this->updateVaultItem($user, $item['type'], $item['id'], $item['fields']);
            }

            $user->forceFill([
                'kdf_salt' => $payload['new_kdf_salt'],
                'kdf_params' => $payload['new_kdf_params'],
                'vault_version' => ((int) $user->vault_version) + 1,
            ])->save();

            $currentRefreshTokenHash = hash('sha256', $payload['current_refresh_token']);

            RefreshToken::query()
                ->where('user_id', $user->id)
                ->where('token_hash', '!=', $currentRefreshTokenHash)
                ->whereNull('revoked_at')
                ->update(['revoked_at' => now()]);

            $currentAccessToken = $user->currentAccessToken();

            $user->tokens()
                ->whereKeyNot($currentAccessToken->getKey())
                ->delete();

            AuditLog::record($user, 'vault.master_password.changed', 'user', (string) $user->id, [
                'items' => count($payload['items']),
                'vault_version' => $user->vault_version,
            ]);
        });

        return response()->json([
            'vault_version' => $user->refresh()->vault_version,
        ]);
    }

    /**
     * @param  array<string, mixed>  $fields
     */
    private function updateVaultItem(User $user, string $type, string $id, array $fields): void
    {
        $resource = VaultResourceRegistry::get($type);
        $allowedFields = array_filter(
            $resource['fields'],
            static fn (string $field): bool => str_ends_with($field, '_ciphertext') || str_ends_with($field, '_nonce'),
        );
        $invalidFields = array_diff(array_keys($fields), $allowedFields);

        if ($invalidFields !== []) {
            throw ValidationException::withMessages([
                'items' => __('One or more vault fields cannot be changed during master password rotation.'),
            ]);
        }

        $modelClass = $resource['model'];

        /** @var Model|null $record */
        $record = $modelClass::query()
            ->whereKey($id)
            ->where('user_id', $user->id)
            ->first();

        if (! $record instanceof Model) {
            throw ValidationException::withMessages([
                'items' => __('One or more vault records are invalid.'),
            ]);
        }

        $record->update($fields);
    }
}
