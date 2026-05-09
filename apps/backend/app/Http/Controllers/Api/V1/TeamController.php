<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Teams\LookupTeamUserRequest;
use App\Http\Requests\Api\V1\Teams\StoreTeamRequest;
use App\Http\Requests\Api\V1\Teams\UpdateTeamRequest;
use App\Models\Team;
use App\Models\User;
use App\Services\TeamService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class TeamController extends Controller
{
    public function __construct(private readonly TeamService $teams) {}

    public function index(Request $request): JsonResponse
    {
        $user = $this->currentUser($request);

        return response()->json([
            'data' => $this->teams
                ->listForUser($user)
                ->map(fn (Team $team): array => $this->teams->serializeTeam($team, $user))
                ->values()
                ->all(),
        ]);
    }

    public function store(StoreTeamRequest $request): JsonResponse
    {
        $user = $this->currentUser($request);
        $team = $this->teams->create($user, $request->payload());

        return response()->json([
            'data' => $this->teams->serializeTeam($team, $user, includeMembers: true),
        ], 201);
    }

    public function show(Request $request, Team $team): JsonResponse
    {
        $user = $this->currentUser($request);

        return response()->json([
            'data' => $this->teams->serializeTeam($team, $user, includeMembers: true),
        ]);
    }

    public function update(UpdateTeamRequest $request, Team $team): JsonResponse
    {
        $user = $this->currentUser($request);
        $team = $this->teams->update($user, $team, $request->payload());

        return response()->json([
            'data' => $this->teams->serializeTeam($team, $user, includeMembers: true),
        ]);
    }

    public function destroy(Request $request, Team $team): JsonResponse
    {
        $this->teams->delete($this->currentUser($request), $team);

        return response()->json(status: 204);
    }

    public function lookupUser(LookupTeamUserRequest $request): JsonResponse
    {
        /** @var string $email */
        $email = $request->validated('email');

        /** @var User $user */
        $user = User::query()
            ->where('email', $email)
            ->whereNull('suspended_at')
            ->firstOrFail();

        return response()->json([
            'data' => $this->teams->serializeUserKey($user),
        ]);
    }

    private function currentUser(Request $request): User
    {
        $user = $request->user();

        abort_unless($user instanceof User, 401);

        return $user;
    }
}
