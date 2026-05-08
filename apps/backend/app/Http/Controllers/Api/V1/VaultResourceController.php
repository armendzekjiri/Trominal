<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\VaultResourceRequest;
use App\Models\AuditLog;
use App\Models\TeamMember;
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
        $teamId = $this->scopeTeamId($request, $resource);

        if ($teamId !== null) {
            $this->ensureTeamMember($user, $teamId);
        }

        /** @var Collection<int, Model> $records */
        $records = $modelClass::query()
            ->when(
                $teamId === null || ! $resource['team_scoped'],
                fn ($query) => $query->where('user_id', $user->id)->when($resource['team_scoped'], fn ($query) => $query->whereNull('team_id')),
                fn ($query) => $query->where('team_id', $teamId),
            )
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
        $teamId = $this->payloadTeamId($payload, $resource);

        if ($teamId !== null) {
            $this->ensureTeamMember($user, $teamId);
        }

        $this->validateRelationshipsBelongToScope($user, $payload, $resource['relationship_fields'], $teamId);

        /** @var Model $record */
        $record = new $modelClass;
        $record->forceFill([
            ...$payload,
            ...($id === null ? [] : ['id' => $id]),
            'user_id' => $user->id,
            ...($resource['team_scoped'] ? ['team_id' => $teamId] : []),
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
        $teamId = $this->recordTeamId($vaultRecord, $resource);

        if (array_key_exists('team_id', $payload) && $payload['team_id'] !== $teamId) {
            throw ValidationException::withMessages([
                'team_id' => __('Vault records cannot be moved between personal and team scopes.'),
            ]);
        }

        $this->validateRelationshipsBelongToScope($user, $payload, $resource['relationship_fields'], $teamId);

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
    private function validateRelationshipsBelongToScope(User $user, array $payload, array $relationshipFields, ?string $teamId): void
    {
        foreach ($relationshipFields as $field => $modelClass) {
            if (! array_key_exists($field, $payload) || $payload[$field] === null) {
                continue;
            }

            $exists = $modelClass::query()
                ->whereKey((string) $payload[$field])
                ->when(
                    $teamId === null,
                    fn ($query) => $query->where('user_id', $user->id)->whereNull('team_id'),
                    fn ($query) => $query->where('team_id', $teamId),
                )
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

    /**
     * @param  array{
     *     team_scoped: bool,
     *     model: class-string<Model>,
     *     permissions: array{read: string, create: string, update: string, delete: string},
     *     fields: list<string>,
     *     required: list<string>,
     *     relationship_fields: array<string, class-string<Model>>
     * }  $resource
     */
    private function scopeTeamId(Request $request, array $resource): ?string
    {
        $team = $request->query('team', $request->query('team_id'));

        if (! is_string($team) || $team === '') {
            return null;
        }

        if (! $resource['team_scoped']) {
            throw ValidationException::withMessages([
                'team' => __('This vault resource does not support team scope.'),
            ]);
        }

        return $team;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  array{
     *     team_scoped: bool,
     *     model: class-string<Model>,
     *     permissions: array{read: string, create: string, update: string, delete: string},
     *     fields: list<string>,
     *     required: list<string>,
     *     relationship_fields: array<string, class-string<Model>>
     * }  $resource
     */
    private function payloadTeamId(array $payload, array $resource): ?string
    {
        if (! array_key_exists('team_id', $payload) || $payload['team_id'] === null) {
            return null;
        }

        if (! $resource['team_scoped']) {
            throw ValidationException::withMessages([
                'team_id' => __('This vault resource does not support team scope.'),
            ]);
        }

        return (string) $payload['team_id'];
    }

    /**
     * @param  array{
     *     team_scoped: bool,
     *     model: class-string<Model>,
     *     permissions: array{read: string, create: string, update: string, delete: string},
     *     fields: list<string>,
     *     required: list<string>,
     *     relationship_fields: array<string, class-string<Model>>
     * }  $resource
     */
    private function recordTeamId(Model $record, array $resource): ?string
    {
        if (! $resource['team_scoped']) {
            return null;
        }

        $teamId = $record->getAttribute('team_id');

        return is_string($teamId) && $teamId !== '' ? $teamId : null;
    }

    private function ensureTeamMember(User $user, string $teamId): void
    {
        $isMember = TeamMember::query()
            ->where('team_id', $teamId)
            ->where('user_id', $user->id)
            ->exists();

        if (! $isMember) {
            throw ValidationException::withMessages([
                'team_id' => __('The selected team is invalid.'),
            ]);
        }
    }

    private function user(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }
}
