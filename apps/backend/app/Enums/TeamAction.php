<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Every team-scoped operation the server authorizes against a caller's team
 * role. See TeamRole::actions() for the matrix.
 */
enum TeamAction: string
{
    /** List, show and delta-sync team vault records. */
    case ReadRecords = 'records.read';

    case CreateRecords = 'records.create';

    case UpdateRecords = 'records.update';

    case DeleteRecords = 'records.delete';

    /** Issue a web SSH session token for a team host. */
    case ConnectHosts = 'hosts.connect';

    case UpdateTeam = 'team.update';

    /** Add or remove members, change non-owner roles, rotate the team key. */
    case ManageMembers = 'members.manage';

    case AssignOwner = 'members.assign_owner';

    case DeleteTeam = 'team.delete';
}
