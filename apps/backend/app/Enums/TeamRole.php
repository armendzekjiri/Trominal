<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Team roles (PROJECT_BRIEF §5.3) and the single source of truth for what
 * each role may do inside its team.
 *
 * The matrix is enforced in addition to — never instead of — the caller's
 * global Spatie permissions: a request must pass both.
 *
 * | action               | owner | admin | member | viewer |
 * |----------------------|-------|-------|--------|--------|
 * | records.read         |   ✓   |   ✓   |   ✓    |   ✓    |
 * | records.create       |   ✓   |   ✓   |   ✓    |        |
 * | records.update       |   ✓   |   ✓   |   ✓    |        |
 * | records.delete       |   ✓   |   ✓   |   ✓    |        |
 * | hosts.connect        |   ✓   |   ✓   |   ✓    |        |
 * | team.update          |   ✓   |   ✓   |        |        |
 * | members.manage       |   ✓   |   ✓   |        |        |
 * | members.assign_owner |   ✓   |       |        |        |
 * | team.delete          |   ✓   |       |        |        |
 *
 * Viewer is read-only. The brief does not define team-viewer semantics, so
 * it follows the least-privilege reading that mirrors the global `guest`
 * role ("read-only, no SSH connect, no edits").
 */
enum TeamRole: string
{
    case Owner = 'owner';
    case Admin = 'admin';
    case Member = 'member';
    case Viewer = 'viewer';

    /**
     * @return list<TeamAction>
     */
    public function actions(): array
    {
        $recordActions = [
            TeamAction::ReadRecords,
            TeamAction::CreateRecords,
            TeamAction::UpdateRecords,
            TeamAction::DeleteRecords,
            TeamAction::ConnectHosts,
        ];

        return match ($this) {
            self::Owner => [
                ...$recordActions,
                TeamAction::UpdateTeam,
                TeamAction::ManageMembers,
                TeamAction::AssignOwner,
                TeamAction::DeleteTeam,
            ],
            self::Admin => [
                ...$recordActions,
                TeamAction::UpdateTeam,
                TeamAction::ManageMembers,
            ],
            self::Member => $recordActions,
            self::Viewer => [TeamAction::ReadRecords],
        };
    }

    public function allows(TeamAction $action): bool
    {
        return in_array($action, $this->actions(), true);
    }
}
