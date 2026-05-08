<?php

declare(strict_types=1);

namespace App\Models;

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

    public const string ROLE_OWNER = 'owner';

    public const string ROLE_ADMIN = 'admin';

    public const string ROLE_MEMBER = 'member';

    public const string ROLE_VIEWER = 'viewer';

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

    public function canManageMembers(): bool
    {
        return in_array($this->role, [self::ROLE_OWNER, self::ROLE_ADMIN], true);
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
