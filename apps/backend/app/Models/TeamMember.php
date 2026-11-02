<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\TeamAction;
use App\Enums\TeamRole;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'team_id',
    'user_id',
    'role',
    'wrapped_team_key_ciphertext',
    'wrapped_team_key_nonce',
    'key_version',
])]
final class TeamMember extends Model
{
    use HasUlids;

    public const string ROLE_OWNER = TeamRole::Owner->value;

    public const string ROLE_ADMIN = TeamRole::Admin->value;

    public const string ROLE_MEMBER = TeamRole::Member->value;

    public const string ROLE_VIEWER = TeamRole::Viewer->value;

    /** @var list<string> */
    public const array ROLES = [
        self::ROLE_OWNER,
        self::ROLE_ADMIN,
        self::ROLE_MEMBER,
        self::ROLE_VIEWER,
    ];

    /**
     * @return BelongsTo<Team, $this>
     */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * The caller's membership in a team, or null when they are not a member.
     */
    public static function forUser(User $user, string $teamId): ?self
    {
        /** @var self|null $member */
        $member = self::query()
            ->where('team_id', $teamId)
            ->where('user_id', $user->id)
            ->first();

        return $member;
    }

    public function teamRole(): ?TeamRole
    {
        return TeamRole::tryFrom((string) $this->role);
    }

    /**
     * Unknown or missing roles are denied everything.
     */
    public function allows(TeamAction $action): bool
    {
        return $this->teamRole()?->allows($action) ?? false;
    }

    public function canManageMembers(): bool
    {
        return $this->allows(TeamAction::ManageMembers);
    }

    public function isOwner(): bool
    {
        return $this->role === self::ROLE_OWNER;
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'wrapped_team_key_ciphertext' => 'encrypted',
            'key_version' => 'integer',
        ];
    }
}
