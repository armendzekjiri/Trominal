<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Teams\RemoveTeamMemberRequest;
use App\Http\Requests\Api\V1\Teams\StoreTeamMemberRequest;
use App\Http\Requests\Api\V1\Teams\UpdateTeamMemberRequest;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use App\Services\TeamService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class TeamMemberController extends Controller
{
    public function __construct(private readonly TeamService $teams) {}

    public function index(Request $request, Team $team): JsonResponse
    {
        $this->teams->requireMember($this->currentUser($request), $team);

        return response()->json([
            'data' => $team->members()
                ->with('user')
                ->latest('created_at')
                ->get()
                ->map(fn (TeamMember $member): array => $this->teams->serializeMember($member, includeUser: true))
                ->values()
                ->all(),
        ]);
    }

    public function store(StoreTeamMemberRequest $request, Team $team): JsonResponse
    {
        $member = $this->teams->addMember(
            $this->currentUser($request),
            $team,
            $request->payload(),
        );

        return response()->json([
            'data' => $this->teams->serializeMember($member, includeUser: true),
        ], 201);
    }

    public function update(UpdateTeamMemberRequest $request, Team $team, TeamMember $member): JsonResponse
    {
        $member = $this->teams->updateMember(
            $this->currentUser($request),
            $team,
            $member,
            $request->payload(),
        );

        return response()->json([
            'data' => $this->teams->serializeMember($member, includeUser: true),
        ]);
    }

    public function destroy(RemoveTeamMemberRequest $request, Team $team, TeamMember $member): JsonResponse
    {
        $this->teams->removeMember(
            $this->currentUser($request),
            $team,
            $member,
            $request->payload(),
        );

        return response()->json(status: 204);
    }

    private function currentUser(Request $request): User
    {
        $user = $request->user();

        abort_unless($user instanceof User, 401);

        return $user;
    }
}
