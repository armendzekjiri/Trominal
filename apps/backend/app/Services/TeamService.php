<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use App\Support\Vault\VaultResourceRegistry;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class TeamService
{
    /**
     * @return Collection<int, Team>
     */
    public function listForUser(User $user): Collection
    {
        /** @var Collection<int, Team> $teams */
        $teams = Team::query()
            ->whereHas('members', fn ($query) => $query->where('user_id', $user->id))
            ->with(['members' => fn ($query) => $query->where('user_id', $user->id)])
            ->latest('updated_at')
            ->get();

        return $teams;
    }

    /**
     * @param  array{
     *     id?: string,
     *     name_ciphertext: string,
     *     name_nonce: string,
     *     wrapped_team_key_ciphertext: string,
     *     wrapped_team_key_nonce: string
     * }  $payload
     */
    public function create(User $actor, array $payload): Team
    {
        return DB::transaction(function () use ($actor, $payload): Team {
            $team = new Team;
            $team->forceFill([
                ...(array_key_exists('id', $payload) ? ['id' => $payload['id']] : []),
                'created_by_user_id' => $actor->id,
                'name_ciphertext' => $payload['name_ciphertext'],
                'name_nonce' => $payload['name_nonce'],
                'key_version' => 1,
            ]);
            $team->save();

            $team->members()->create([
                'user_id' => $actor->id,
                'role' => TeamMember::ROLE_OWNER,
                'wrapped_team_key_ciphertext' => $payload['wrapped_team_key_ciphertext'],
                'wrapped_team_key_nonce' => $payload['wrapped_team_key_nonce'],
                'key_version' => 1,
            ]);

            AuditLog::record($actor, 'team.created', 'team', (string) $team->id);

            return $team->refresh();
        });
    }

    /**
     * @param  array{name_ciphertext: string, name_nonce: string}  $payload
     */
    public function update(User $actor, Team $team, array $payload): Team
    {
        $this->requireManager($actor, $team);

        $team->update($payload);

        AuditLog::record($actor, 'team.updated', 'team', (string) $team->id);

        return $team->refresh();
    }

    public function delete(User $actor, Team $team): void
    {
        $membership = $this->requireMember($actor, $team);

        if (! $membership->isOwner()) {
            throw new AuthorizationException('Only team owners can delete a team.');
        }

        $team->delete();

        AuditLog::record($actor, 'team.deleted', 'team', (string) $team->id);
    }

    /**
     * @param  array{
     *     user_id: string,
     *     role: string,
     *     wrapped_team_key_ciphertext: string,
     *     wrapped_team_key_nonce: string
     * }  $payload
     */
    public function addMember(User $actor, Team $team, array $payload): TeamMember
    {
        $actorMembership = $this->requireManager($actor, $team);

        if ($payload['role'] === TeamMember::ROLE_OWNER && ! $actorMembership->isOwner()) {
            throw new AuthorizationException('Only team owners can add another owner.');
        }

        /** @var User $targetUser */
        $targetUser = User::query()->whereKey($payload['user_id'])->firstOrFail();

        if ($targetUser->suspended_at !== null) {
            throw ValidationException::withMessages([
                'user_id' => __('Suspended users cannot be added to teams.'),
            ]);
        }

        if ($team->members()->where('user_id', $targetUser->id)->exists()) {
            throw ValidationException::withMessages([
                'user_id' => __('The user is already a member of this team.'),
            ]);
        }

        /** @var TeamMember $member */
        $member = $team->members()->create([
            'user_id' => $targetUser->id,
            'role' => $payload['role'],
            'wrapped_team_key_ciphertext' => $payload['wrapped_team_key_ciphertext'],
            'wrapped_team_key_nonce' => $payload['wrapped_team_key_nonce'],
            'key_version' => $team->key_version,
        ]);

        AuditLog::record($actor, 'team.member.added', 'team_member', (string) $member->id, [
            'team_id' => (string) $team->id,
            'user_id' => (string) $targetUser->id,
            'role' => $payload['role'],
        ]);

        return $member->refresh();
    }

    /**
     * @param  array{role: string}  $payload
     */
    public function updateMember(User $actor, Team $team, TeamMember $member, array $payload): TeamMember
    {
        $actorMembership = $this->requireManager($actor, $team);
        $this->ensureMemberBelongsToTeam($team, $member);

        if ($payload['role'] === TeamMember::ROLE_OWNER && ! $actorMembership->isOwner()) {
            throw new AuthorizationException('Only team owners can assign owner role.');
        }

        if ($member->isOwner() && $payload['role'] !== TeamMember::ROLE_OWNER) {
            $this->assertNotLastOwner($team, $member);
        }

        $member->update(['role' => $payload['role']]);

        AuditLog::record($actor, 'team.member.role_changed', 'team_member', (string) $member->id, [
            'team_id' => (string) $team->id,
            'role' => $payload['role'],
        ]);

        return $member->refresh();
    }

    /**
     * @param  array{
     *     remaining_members: list<array{member_id: string, wrapped_team_key_ciphertext: string, wrapped_team_key_nonce: string}>,
     *     reencrypted_resources: list<array{type: string, id: string, fields: array<string, mixed>}>
     * }  $payload
     */
    public function removeMember(User $actor, Team $team, TeamMember $member, array $payload): void
    {
        $this->requireManager($actor, $team);
        $this->ensureMemberBelongsToTeam($team, $member);

        if ($member->isOwner()) {
            $this->assertNotLastOwner($team, $member);
        }

        DB::transaction(function () use ($actor, $team, $member, $payload): void {
            $team->refresh();
            $remainingMembers = $team->members()
                ->whereKeyNot($member->id)
                ->lockForUpdate()
                ->get();

            $rewrapByMemberId = $this->validateRotationPayload($remainingMembers, $payload['remaining_members']);
            $newKeyVersion = ((int) $team->key_version) + 1;

            foreach ($remainingMembers as $remainingMember) {
                $rewrap = $rewrapByMemberId[(string) $remainingMember->id];
                $remainingMember->update([
                    'wrapped_team_key_ciphertext' => $rewrap['wrapped_team_key_ciphertext'],
                    'wrapped_team_key_nonce' => $rewrap['wrapped_team_key_nonce'],
                    'key_version' => $newKeyVersion,
                ]);
            }

            // Re-encrypt every team-scoped vault record under the new team
            // key. The brief (§5.3) requires this so the removed member's
            // retained plaintext key cannot decrypt the records later — the
            // wrapped-key rotation alone leaves the on-disk ciphertext
            // recoverable with the old key. Validation runs first so the
            // whole operation is atomic.
            $rotated = $this->applyResourceReencryption(
                $team,
                $payload['reencrypted_resources'],
            );

            $member->delete();
            $team->forceFill(['key_version' => $newKeyVersion])->save();

            AuditLog::record($actor, 'team.member.removed', 'team_member', (string) $member->id, [
                'team_id' => (string) $team->id,
                'removed_user_id' => (string) $member->user_id,
                'key_version' => $newKeyVersion,
                'resources_rotated' => $rotated,
            ]);
        });
    }

    public function requireMember(User $actor, Team $team): TeamMember
    {
        /** @var TeamMember|null $member */
        $member = $team->members()->where('user_id', $actor->id)->first();

        if (! $member instanceof TeamMember) {
            throw new AuthorizationException('You are not a member of this team.');
        }

        return $member;
    }

    /**
     * @return array<string, mixed>
     */
    public function serializeTeam(Team $team, User $actor, bool $includeMembers = false): array
    {
        $membership = $this->requireMember($actor, $team);
        $payload = [
            'id' => (string) $team->id,
            'name_ciphertext' => $team->name_ciphertext,
            'name_nonce' => $team->name_nonce,
            'key_version' => $team->key_version,
            'current_member' => $this->serializeMember($membership),
            'created_at' => $team->created_at?->toIso8601String(),
            'updated_at' => $team->updated_at?->toIso8601String(),
        ];

        if ($includeMembers) {
            $payload['members'] = $team->members()
                ->with('user')
                ->latest('created_at')
                ->get()
                ->map(fn (TeamMember $member): array => $this->serializeMember($member, includeUser: true))
                ->values()
                ->all();
        }

        return $payload;
    }

    /**
     * @return array<string, mixed>
     */
    public function serializeMember(TeamMember $member, bool $includeUser = false): array
    {
        $payload = [
            'id' => (string) $member->id,
            'team_id' => (string) $member->team_id,
            'user_id' => (string) $member->user_id,
            'role' => $member->role,
            'wrapped_team_key_ciphertext' => $member->wrapped_team_key_ciphertext,
            'wrapped_team_key_nonce' => $member->wrapped_team_key_nonce,
            'key_version' => $member->key_version,
            'created_at' => $member->created_at?->toIso8601String(),
            'updated_at' => $member->updated_at?->toIso8601String(),
        ];

        if ($includeUser) {
            $member->loadMissing('user');
            /** @var User $user */
            $user = $member->user;
            $payload['user'] = $this->serializeUserKey($user);
        }

        return $payload;
    }

    /**
     * @return array{id: string, name: ?string, email: string, public_key: string}
     */
    public function serializeUserKey(User $user): array
    {
        return [
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'public_key' => $user->public_key,
        ];
    }

    private function requireManager(User $actor, Team $team): TeamMember
    {
        $membership = $this->requireMember($actor, $team);

        if (! $membership->canManageMembers()) {
            throw new AuthorizationException('You cannot manage this team.');
        }

        return $membership;
    }

    private function ensureMemberBelongsToTeam(Team $team, TeamMember $member): void
    {
        if ((string) $member->team_id !== (string) $team->id) {
            throw ValidationException::withMessages([
                'member' => __('The selected team member is invalid.'),
            ]);
        }
    }

    /**
     * Replay the client-supplied re-encrypted ciphertext into every
     * team-scoped vault record. Throws if any expected record is missing
     * or any unexpected record is supplied — the caller's transaction
     * rolls back on either branch.
     *
     * @param  list<array{type: string, id: string, fields: array<string, mixed>}>  $reencrypted
     */
    private function applyResourceReencryption(Team $team, array $reencrypted): int
    {
        $expected = $this->collectTeamScopedResources($team);
        $expectedKeys = [];
        foreach ($expected as $type => $records) {
            foreach ($records as $record) {
                $expectedKeys[$type.':'.(string) $record->getKey()] = true;
            }
        }
        $providedKeys = [];

        foreach ($reencrypted as $entry) {
            $type = $entry['type'];
            $id = $entry['id'];
            $key = $type.':'.$id;

            if (! array_key_exists($key, $expectedKeys)) {
                throw ValidationException::withMessages([
                    'reencrypted_resources' => __('Unexpected vault record was supplied for re-encryption.'),
                ]);
            }
            if (array_key_exists($key, $providedKeys)) {
                throw ValidationException::withMessages([
                    'reencrypted_resources' => __('Duplicate vault record in re-encryption payload.'),
                ]);
            }
            $providedKeys[$key] = true;

            $resource = VaultResourceRegistry::get($type);
            $allowedFields = array_filter(
                $resource['fields'],
                static fn (string $field): bool => str_ends_with($field, '_ciphertext') || str_ends_with($field, '_nonce'),
            );
            $invalidFields = array_diff(array_keys($entry['fields']), $allowedFields);
            if ($invalidFields !== []) {
                throw ValidationException::withMessages([
                    'reencrypted_resources' => __('One or more vault fields cannot be changed during team rotation.'),
                ]);
            }

            /** @var Model $record */
            $record = $expected[$type]->firstWhere(
                static fn (Model $row): bool => (string) $row->getKey() === $id,
            );
            $record->update($entry['fields']);
        }

        $missingKeys = array_diff_key($expectedKeys, $providedKeys);
        if ($missingKeys !== []) {
            throw ValidationException::withMessages([
                'reencrypted_resources' => __('Every team-scoped vault record must be re-encrypted before removing a member.'),
            ]);
        }

        return count($expectedKeys);
    }

    /**
     * Pluck every team-scoped vault record under this team, locking each
     * row for the rotation transaction.
     *
     * @return array<string, Collection<int, Model>>
     */
    private function collectTeamScopedResources(Team $team): array
    {
        $bundle = [];
        foreach (VaultResourceRegistry::all() as $type => $resource) {
            if (! $resource['team_scoped']) {
                continue;
            }
            /** @var class-string<Model> $modelClass */
            $modelClass = $resource['model'];
            /** @var Collection<int, Model> $records */
            $records = $modelClass::query()
                ->where('team_id', $team->id)
                ->lockForUpdate()
                ->get();
            $bundle[$type] = $records;
        }

        return $bundle;
    }

    private function assertNotLastOwner(Team $team, TeamMember $member): void
    {
        $ownerCount = $team->members()
            ->where('role', TeamMember::ROLE_OWNER)
            ->whereKeyNot($member->id)
            ->count();

        if ($ownerCount < 1) {
            throw ValidationException::withMessages([
                'role' => __('A team must keep at least one owner.'),
            ]);
        }
    }

    /**
     * @param  Collection<int, TeamMember>  $remainingMembers
     * @param  list<array{member_id: string, wrapped_team_key_ciphertext: string, wrapped_team_key_nonce: string}>  $rewraps
     * @return array<string, array{wrapped_team_key_ciphertext: string, wrapped_team_key_nonce: string}>
     */
    private function validateRotationPayload(Collection $remainingMembers, array $rewraps): array
    {
        $expectedIds = $remainingMembers
            ->pluck('id')
            ->map(static fn (mixed $id): string => (string) $id)
            ->sort()
            ->values()
            ->all();
        $providedIds = collect($rewraps)
            ->pluck('member_id')
            ->map(static fn (mixed $id): string => (string) $id)
            ->sort()
            ->values()
            ->all();

        if ($expectedIds !== $providedIds || count($providedIds) !== count(array_unique($providedIds))) {
            throw ValidationException::withMessages([
                'remaining_members' => __('Remaining member key wraps must match every member after removal.'),
            ]);
        }

        $byMemberId = [];
        foreach ($rewraps as $rewrap) {
            $byMemberId[$rewrap['member_id']] = [
                'wrapped_team_key_ciphertext' => $rewrap['wrapped_team_key_ciphertext'],
                'wrapped_team_key_nonce' => $rewrap['wrapped_team_key_nonce'],
            ];
        }

        return $byMemberId;
    }
}
