<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\TeamMember;
use App\Models\User;
use App\Support\Vault\SerializesVaultRecords;
use App\Support\Vault\VaultResourceRegistry;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletingScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

final class VaultSyncController extends Controller
{
    use SerializesVaultRecords;

    public function __invoke(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $cursor = $request->query('cursor');
        $since = is_string($cursor) && $cursor !== '' ? Carbon::parse($cursor) : null;
        $serverCursor = now();
        $data = [];
        /** @var list<string> $teamIds */
        $teamIds = TeamMember::query()
            ->where('user_id', $user->id)
            ->pluck('team_id')
            ->map(static fn (mixed $teamId): string => (string) $teamId)
            ->all();

        foreach (VaultResourceRegistry::all() as $type => $resource) {
            if (! $user->can($resource['permissions']['read'])) {
                continue;
            }

            $modelClass = $resource['model'];

            /** @var Collection<int, Model> $records */
            $records = $modelClass::query()
                ->withoutGlobalScope(SoftDeletingScope::class)
                ->where(function ($query) use ($resource, $teamIds, $user): void {
                    $query->where(function ($query) use ($user, $resource): void {
                        $query
                            ->where('user_id', $user->id)
                            ->when($resource['team_scoped'], fn ($query) => $query->whereNull('team_id'));
                    });

                    if ($resource['team_scoped'] && $teamIds !== []) {
                        $query->orWhereIn('team_id', $teamIds);
                    }
                })
                ->when($since !== null, fn ($query) => $query->where(function ($query) use ($since): void {
                    $query
                        ->where('updated_at', '>', $since)
                        ->orWhere('deleted_at', '>', $since);
                }))
                ->orderBy('updated_at')
                ->get();

            $data[$type] = $records
                ->map(fn (Model $record): array => $this->serializeVaultRecord($record, $type, $resource['fields']))
                ->values()
                ->all();
        }

        return response()->json([
            'cursor' => $serverCursor->toIso8601String(),
            'vault_version' => $user->vault_version,
            'data' => $data,
        ]);
    }
}
