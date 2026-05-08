<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\VaultResourceRequest;
use App\Models\AuditLog;
use App\Models\User;
use App\Support\Vault\SerializesVaultRecords;
use App\Support\Vault\VaultResourceRegistry;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class VaultResourceController extends Controller
{
    use SerializesVaultRecords;

    public function index(Request $request, string $vaultType): JsonResponse
    {
        $user = $this->user($request);
        $resource = VaultResourceRegistry::get($vaultType);
        $modelClass = $resource['model'];

        /** @var Collection<int, Model> $records */
        $records = $modelClass::query()
            ->where('user_id', $user->id)
            ->latest('updated_at')
            ->get();

        return response()->json([
            'data' => $records
                ->map(fn (Model $record): array => $this->serializeVaultRecord($record, $vaultType, $resource['fields']))
                ->values()
                ->all(),
        ]);
    }

    public function store(VaultResourceRequest $request, string $vaultType): JsonResponse
    {
        $user = $this->user($request);
        $resource = $request->vaultResource();
        $modelClass = $resource['model'];
        $payload = $request->payload();
        $id = $request->recordId();

        $this->validateRelationshipsBelongToUser($user, $payload, $resource['relationship_fields']);

        /** @var Model $record */
        $record = new $modelClass;
        $record->forceFill([
            ...$payload,
            ...($id === null ? [] : ['id' => $id]),
            'user_id' => $user->id,
        ]);
        $record->save();

        AuditLog::record($user, "vault.{$vaultType}.created", $vaultType, (string) $record->getKey());

        return response()->json([
            'data' => $this->serializeVaultRecord($record, $vaultType, $resource['fields']),
        ], 201);
    }

    public function show(Request $request, string $record, string $vaultType): JsonResponse
    {
        $resource = VaultResourceRegistry::get($vaultType);
        $vaultRecord = $this->resolveRecord($resource['model'], $record);

        Gate::authorize('view', $vaultRecord);

        return response()->json([
            'data' => $this->serializeVaultRecord($vaultRecord, $vaultType, $resource['fields']),
        ]);
    }

    public function update(VaultResourceRequest $request, string $record, string $vaultType): JsonResponse
    {
        $user = $this->user($request);
        $resource = $request->vaultResource();
        $vaultRecord = $this->resolveRecord($resource['model'], $record);

        Gate::authorize('update', $vaultRecord);

        $payload = $request->payload();
        $this->validateRelationshipsBelongToUser($user, $payload, $resource['relationship_fields']);

        $vaultRecord->update($payload);

        AuditLog::record($user, "vault.{$vaultType}.updated", $vaultType, (string) $vaultRecord->getKey());

        return response()->json([
            'data' => $this->serializeVaultRecord($vaultRecord->refresh(), $vaultType, $resource['fields']),
        ]);
    }

    public function destroy(Request $request, string $record, string $vaultType): JsonResponse
    {
        $user = $this->user($request);
        $resource = VaultResourceRegistry::get($vaultType);
        $vaultRecord = $this->resolveRecord($resource['model'], $record);

        Gate::authorize('delete', $vaultRecord);

        $vaultRecord->delete();

        AuditLog::record($user, "vault.{$vaultType}.deleted", $vaultType, (string) $vaultRecord->getKey());

        return response()->json(status: 204);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  array<string, class-string<Model>>  $relationshipFields
     */
    private function validateRelationshipsBelongToUser(User $user, array $payload, array $relationshipFields): void
    {
        foreach ($relationshipFields as $field => $modelClass) {
            if (! array_key_exists($field, $payload) || $payload[$field] === null) {
                continue;
            }

            $exists = $modelClass::query()
                ->whereKey((string) $payload[$field])
                ->where('user_id', $user->id)
                ->exists();

            if (! $exists) {
                throw ValidationException::withMessages([
                    $field => __('The selected vault record is invalid.'),
                ]);
            }
        }
    }

    /**
     * @param  class-string<Model>  $modelClass
     */
    private function resolveRecord(string $modelClass, string $id): Model
    {
        /** @var Model $record */
        $record = $modelClass::query()->findOrFail($id);

        return $record;
    }

    private function user(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }
}
