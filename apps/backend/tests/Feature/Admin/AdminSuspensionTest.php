<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Filament\Resources\Users\Pages\EditUser;
use App\Filament\Resources\Users\Pages\ListUsers;
use App\Models\AuditLog;
use App\Models\RefreshToken;
use App\Models\User;
use Database\Seeders\AppSettingSeeder;
use Database\Seeders\RoleAndPermissionSeeder;
use Filament\Actions\Testing\TestAction;
use Filament\Facades\Filament;
use Illuminate\Auth\AuthManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Livewire\Livewire;
use Tests\TestCase;

/**
 * Every suspension entry path must end the target's sessions, so that
 * credentials issued before the suspension stay dead after unsuspension.
 */
final class AdminSuspensionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(AppSettingSeeder::class);
        $this->seed(RoleAndPermissionSeeder::class);
        Filament::setCurrentPanel(Filament::getPanel('admin'));
    }

    public function test_suspending_through_the_edit_form_revokes_every_session(): void
    {
        $admin = $this->createAdmin();
        $target = $this->createUser();
        ['access' => $access, 'refresh' => $refresh] = $this->issueCredentials($target);
        $this->actingAs($admin);

        Livewire::test(EditUser::class, ['record' => $target->getRouteKey()])
            ->fillForm(['suspended' => true])
            ->call('save')
            ->assertHasNoFormErrors();

        $target->refresh();
        self::assertNotNull($target->suspended_at);
        $this->assertSessionsRevoked($target);
        $this->assertAuditedOnce('admin.user.suspended', $target, $admin);

        $this->assertCredentialsRejected($access, $refresh);
    }

    public function test_suspending_through_the_table_action_revokes_every_session(): void
    {
        $admin = $this->createAdmin();
        $target = $this->createUser();
        ['access' => $access, 'refresh' => $refresh] = $this->issueCredentials($target);
        $this->actingAs($admin);

        Livewire::test(ListUsers::class)
            ->callAction(TestAction::make('suspend')->table($target));

        $target->refresh();
        self::assertNotNull($target->suspended_at);
        $this->assertSessionsRevoked($target);
        $this->assertAuditedOnce('admin.user.suspended', $target, $admin);

        $this->assertCredentialsRejected($access, $refresh);
    }

    public function test_credentials_issued_before_suspension_stay_unusable_after_unsuspension(): void
    {
        $admin = $this->createAdmin();
        $target = $this->createUser();
        ['access' => $access, 'refresh' => $refresh] = $this->issueCredentials($target);
        $this->actingAs($admin);

        Livewire::test(EditUser::class, ['record' => $target->getRouteKey()])
            ->fillForm(['suspended' => true])
            ->call('save');

        Livewire::test(EditUser::class, ['record' => $target->getRouteKey()])
            ->assertFormSet(['suspended' => true])
            ->fillForm(['suspended' => false])
            ->call('save')
            ->assertHasNoFormErrors();

        self::assertNull($target->fresh()?->suspended_at);
        $this->assertAuditedOnce('admin.user.unsuspended', $target, $admin);

        $this->assertCredentialsRejected($access, $refresh);

        // A fresh sign-in after unsuspension works normally.
        $fresh = $target->createToken('after unsuspend')->plainTextToken;
        $this->app->make(AuthManager::class)->forgetGuards();
        $this->getJson('/api/v1/me', ['Authorization' => "Bearer {$fresh}"])->assertOk();
    }

    public function test_editing_other_fields_does_not_touch_suspension_or_sessions(): void
    {
        $admin = $this->createAdmin();
        $target = $this->createUser();
        $this->issueCredentials($target);
        $this->actingAs($admin);

        Livewire::test(EditUser::class, ['record' => $target->getRouteKey()])
            ->fillForm(['name' => 'Renamed'])
            ->call('save')
            ->assertHasNoFormErrors();

        self::assertNull($target->fresh()?->suspended_at);
        self::assertSame(1, $target->tokens()->count());
        self::assertFalse(AuditLog::query()->where('action', 'admin.user.suspended')->exists());
    }

    public function test_suspending_the_last_usable_administrator_is_rejected(): void
    {
        $actingAdmin = $this->createAdmin();
        $otherAdmin = $this->createAdmin();
        $this->issueCredentials($otherAdmin);
        $this->actingAs($actingAdmin);

        $page = Livewire::test(ListUsers::class);

        // Simulates a concurrent change that suspended the acting admin first.
        $actingAdmin->forceFill(['suspended_at' => now()])->save();

        $page->callAction(TestAction::make('suspend')->table($otherAdmin));

        self::assertNull($otherAdmin->fresh()?->suspended_at);
        self::assertSame(1, $otherAdmin->tokens()->count());
        self::assertFalse(AuditLog::query()->where('action', 'admin.user.suspended')->exists());
    }

    public function test_admins_cannot_suspend_themselves_through_the_edit_form(): void
    {
        $admin = $this->createAdmin();
        $this->createAdmin();
        $this->actingAs($admin);

        Livewire::test(EditUser::class, ['record' => $admin->getRouteKey()])
            ->assertFormFieldIsDisabled('suspended')
            ->fillForm(['suspended' => true])
            ->call('save');

        self::assertNull($admin->fresh()?->suspended_at);
    }

    /**
     * @return array{access: string, refresh: string}
     */
    private function issueCredentials(User $user): array
    {
        $refresh = 'refresh-'.$user->id;

        RefreshToken::query()->create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $refresh),
            'expires_at' => now()->addDay(),
        ]);

        DB::table('sessions')->insert([
            'id' => 'session-'.$user->id,
            'user_id' => $user->id,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'test',
            'payload' => '',
            'last_activity' => now()->getTimestamp(),
        ]);

        return ['access' => $user->createToken('before suspension')->plainTextToken, 'refresh' => $refresh];
    }

    private function assertSessionsRevoked(User $user): void
    {
        self::assertSame(0, $user->tokens()->count());
        self::assertSame(0, RefreshToken::query()->where('user_id', $user->id)->whereNull('revoked_at')->count());
        self::assertSame(0, DB::table('sessions')->where('user_id', $user->id)->count());
    }

    private function assertCredentialsRejected(string $access, string $refresh): void
    {
        $this->app->make(AuthManager::class)->forgetGuards();
        $this->getJson('/api/v1/me', ['Authorization' => "Bearer {$access}"])->assertUnauthorized();

        $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $refresh])->assertUnprocessable();
    }

    private function assertAuditedOnce(string $action, User $target, User $actor): void
    {
        $logs = AuditLog::query()->where('action', $action)->where('resource_id', $target->id)->get();

        self::assertCount(1, $logs, $action);
        self::assertSame((string) $actor->id, (string) $logs->first()?->actor_user_id);
    }

    private function createAdmin(): User
    {
        $user = $this->createUser();
        $user->assignRole('admin');

        return $user;
    }

    private function createUser(): User
    {
        /** @var User $user */
        $user = User::factory()->create([
            'two_fa_enabled_at' => now(),
            'two_fa_secret_enc' => 'TESTTOTPSECRET',
        ]);
        $user->assignRole('user');

        return $user;
    }
}
