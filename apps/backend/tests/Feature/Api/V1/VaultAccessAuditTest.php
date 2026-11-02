<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Models\AuditLog;
use App\Models\Host;
use App\Models\Snippet;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Auth\AuthManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Vault reads are audited without ever recording ciphertext, nonces or other
 * vault payloads, and high-frequency reads are coalesced to keep the audit
 * log usable.
 */
final class VaultAccessAuditTest extends TestCase
{
    use RefreshDatabase;

    private const string SECRET_MARKER = 'vault-secret-marker';

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_viewing_a_record_writes_one_audit_entry_per_request(): void
    {
        $user = $this->userWithRole('user');
        $host = $this->createHost($user);
        $headers = $this->bearerHeaders($user);

        $this->getJson("/api/v1/vault/hosts/{$host->id}", $headers)->assertOk();
        $this->getJson("/api/v1/vault/hosts/{$host->id}", $headers)->assertOk();

        $logs = AuditLog::query()->where('action', 'vault.hosts.viewed')->get();

        self::assertCount(2, $logs);
        self::assertSame((string) $user->id, (string) $logs[0]->actor_user_id);
        self::assertSame('hosts', $logs[0]->resource_type);
        self::assertSame((string) $host->id, $logs[0]->resource_id);
        self::assertSame(['scope' => 'personal'], $logs[0]->metadata);
        $this->assertNoVaultPayloadIsAudited();
    }

    public function test_denied_record_reads_are_not_audited_as_views(): void
    {
        $owner = $this->userWithRole('user');
        $host = $this->createHost($owner);

        $this->getJson("/api/v1/vault/hosts/{$host->id}", $this->bearerHeaders($this->userWithRole('user')))
            ->assertForbidden();

        self::assertFalse(AuditLog::query()->where('action', 'vault.hosts.viewed')->exists());
    }

    public function test_listing_records_audits_the_resource_type_scope_and_count(): void
    {
        $user = $this->userWithRole('user');
        $this->createHost($user);
        $this->createHost($user);
        $team = $this->createTeam($user);
        $this->createHost($user, $team);

        $this->getJson('/api/v1/vault/hosts', $this->bearerHeaders($user))->assertOk();
        $this->getJson("/api/v1/vault/hosts?team={$team->id}", $this->bearerHeaders($user))->assertOk();

        $logs = AuditLog::query()->where('action', 'vault.hosts.listed')->orderBy('created_at')->get();

        self::assertCount(2, $logs);
        self::assertSame('hosts', $logs[0]->resource_type);
        self::assertNull($logs[0]->resource_id);
        self::assertSame(['scope' => 'personal', 'count' => 2], $logs[0]->metadata);
        self::assertSame(['scope' => 'team', 'team_id' => (string) $team->id, 'count' => 1], $logs[1]->metadata);
        $this->assertNoVaultPayloadIsAudited();
    }

    public function test_identical_repeated_listings_are_coalesced(): void
    {
        Carbon::setTestNow(now());
        $user = $this->userWithRole('user');
        $this->createHost($user);
        $headers = $this->bearerHeaders($user);

        for ($i = 0; $i < 5; $i++) {
            $this->getJson('/api/v1/vault/hosts', $headers)->assertOk();
        }

        self::assertSame(1, AuditLog::query()->where('action', 'vault.hosts.listed')->count());

        // A different result set is a different disclosure and is recorded.
        $this->createHost($user);
        $this->getJson('/api/v1/vault/hosts', $headers)->assertOk();

        self::assertSame(2, AuditLog::query()->where('action', 'vault.hosts.listed')->count());

        // Once the coalescing window has passed the same listing is recorded again.
        Carbon::setTestNow(now()->addMinutes(6));
        $this->getJson('/api/v1/vault/hosts', $headers)->assertOk();

        self::assertSame(3, AuditLog::query()->where('action', 'vault.hosts.listed')->count());
    }

    public function test_full_sync_is_always_audited_with_per_type_counts(): void
    {
        $user = $this->userWithRole('user');
        $this->createHost($user);
        $this->createHost($user);
        $this->createSnippet($user);
        $team = $this->createTeam($user);
        $this->createHost($user, $team);
        $headers = $this->bearerHeaders($user);

        $this->getJson('/api/v1/vault/sync', $headers)->assertOk();
        $this->getJson('/api/v1/vault/sync', $headers)->assertOk();

        $logs = AuditLog::query()->where('action', 'vault.synced')->get();

        self::assertCount(2, $logs);
        self::assertSame('vault', $logs[0]->resource_type);
        self::assertSame([
            'mode' => 'full',
            'total' => 4,
            'counts' => ['hosts' => 3, 'snippets' => 1],
            'teams' => 1,
        ], $logs[0]->metadata);
        $this->assertNoVaultPayloadIsAudited();
    }

    public function test_delta_sync_with_changes_is_audited_and_empty_polls_are_coalesced(): void
    {
        Carbon::setTestNow(now());
        $user = $this->userWithRole('user');
        $headers = $this->bearerHeaders($user);
        $cursor = rawurlencode(now()->subMinute()->toIso8601String());

        // Empty delta polls: one entry per coalescing window.
        for ($i = 0; $i < 5; $i++) {
            $this->getJson("/api/v1/vault/sync?cursor={$cursor}", $headers)->assertOk();
        }

        $empty = AuditLog::query()->where('action', 'vault.synced')->get();
        self::assertCount(1, $empty);
        self::assertSame(['mode' => 'delta', 'total' => 0, 'counts' => [], 'teams' => 0], $empty[0]->metadata);

        // Delta polls that return records are always recorded.
        $this->createHost($user);
        $this->getJson("/api/v1/vault/sync?cursor={$cursor}", $headers)->assertOk();
        $this->getJson("/api/v1/vault/sync?cursor={$cursor}", $headers)->assertOk();

        $withChanges = AuditLog::query()
            ->where('action', 'vault.synced')
            ->get()
            ->filter(fn (AuditLog $log): bool => ($log->metadata['total'] ?? 0) === 1);
        self::assertCount(2, $withChanges);

        // After the window, an empty poll is recorded again.
        Carbon::setTestNow(now()->addMinutes(16));
        $later = rawurlencode(now()->toIso8601String());
        $this->getJson("/api/v1/vault/sync?cursor={$later}", $headers)->assertOk();

        self::assertSame(4, AuditLog::query()->where('action', 'vault.synced')->count());
        $this->assertNoVaultPayloadIsAudited();
    }

    private function assertNoVaultPayloadIsAudited(): void
    {
        foreach (AuditLog::query()->get() as $log) {
            $encoded = (string) json_encode($log->toArray());

            self::assertStringNotContainsString(self::SECRET_MARKER, $encoded, (string) $log->action);
            self::assertStringNotContainsString('_ciphertext', $encoded, (string) $log->action);
            self::assertStringNotContainsString('_nonce', $encoded, (string) $log->action);
        }
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    private function createHost(User $user, ?Team $team = null): Host
    {
        /** @var Host $host */
        $host = Host::query()->create([
            'user_id' => $user->id,
            'team_id' => $team?->id,
            'name_ciphertext' => self::SECRET_MARKER.'-name',
            'name_nonce' => self::SECRET_MARKER.'-name-nonce',
            'hostname_ciphertext' => self::SECRET_MARKER.'-address',
            'hostname_nonce' => self::SECRET_MARKER.'-address-nonce',
        ]);

        return $host;
    }

    private function createSnippet(User $user): Snippet
    {
        /** @var Snippet $snippet */
        $snippet = Snippet::query()->create([
            'user_id' => $user->id,
            'title_ciphertext' => self::SECRET_MARKER.'-title',
            'title_nonce' => self::SECRET_MARKER.'-title-nonce',
            'body_ciphertext' => self::SECRET_MARKER.'-body',
            'body_nonce' => self::SECRET_MARKER.'-body-nonce',
        ]);

        return $snippet;
    }

    private function createTeam(User $owner): Team
    {
        /** @var Team $team */
        $team = Team::query()->create([
            'created_by_user_id' => $owner->id,
            'name_ciphertext' => self::SECRET_MARKER.'-team',
            'name_nonce' => self::SECRET_MARKER.'-team-nonce',
            'key_version' => 1,
        ]);

        TeamMember::query()->create([
            'team_id' => $team->id,
            'user_id' => $owner->id,
            'role' => TeamMember::ROLE_OWNER,
            'wrapped_team_key_ciphertext' => self::SECRET_MARKER.'-wrapped',
            'wrapped_team_key_nonce' => self::SECRET_MARKER.'-wrapped-nonce',
            'key_version' => 1,
        ]);

        return $team;
    }

    /**
     * @return array{Authorization: string}
     */
    private function bearerHeaders(User $user): array
    {
        $this->app->make(AuthManager::class)->forgetGuards();

        return ['Authorization' => 'Bearer '.$user->createToken('Vault access audit test')->plainTextToken];
    }
}
