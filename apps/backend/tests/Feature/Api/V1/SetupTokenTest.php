<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Models\AppSetting;
use App\Models\AuditLog;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithAuthApi;
use Tests\TestCase;

final class SetupTokenTest extends TestCase
{
    use InteractsWithAuthApi;
    use RefreshDatabase;

    private const SETUP_TOKEN = 'setup-0123456789abcdef0123456789abcdef';

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
    }

    public function test_setup_token_is_not_required_when_not_configured(): void
    {
        config(['trominal.setup_token' => null]);

        $this->getJson('/api/server-info')->assertOk()->assertJsonPath('setup_token_required', false);
        $this->registerUser()->assertCreated();
    }

    public function test_the_first_registration_must_present_the_configured_setup_token(): void
    {
        config(['trominal.setup_token' => self::SETUP_TOKEN]);

        $this->registerUser()->assertForbidden();
        $this->registerUser(overrides: ['setup_token' => 'setup-wrong-value'])->assertForbidden();

        self::assertSame(0, User::query()->count());
        self::assertTrue((bool) AppSetting::registration()->value['open']);
        self::assertSame(2, AuditLog::query()->where('action', 'auth.register.setup_token_rejected')->count());

        $response = $this->registerUser(overrides: ['setup_token' => self::SETUP_TOKEN])->assertCreated();

        self::assertContains('admin', (array) $response->json('user.roles'));
    }

    public function test_server_info_reports_the_requirement_without_exposing_the_token(): void
    {
        config(['trominal.setup_token' => self::SETUP_TOKEN]);

        $info = $this->getJson('/api/server-info')->assertOk()->assertJsonPath('setup_token_required', true);
        self::assertStringNotContainsString(self::SETUP_TOKEN, (string) $info->getContent());

        $this->registerUser(overrides: ['setup_token' => self::SETUP_TOKEN])->assertCreated();

        // Once the instance has its first user, the setup code is no longer relevant.
        $this->getJson('/api/server-info')->assertOk()->assertJsonPath('setup_token_required', false);
    }

    public function test_later_registrations_do_not_need_the_setup_token(): void
    {
        config(['trominal.setup_token' => self::SETUP_TOKEN]);

        $this->registerUser(overrides: ['setup_token' => self::SETUP_TOKEN])->assertCreated();

        AppSetting::registration()->update([
            'value' => [
                'mode' => 'open',
                'open' => true,
                'instance_name' => 'Trominal',
                'web_ssh_enabled' => false,
            ],
        ]);

        $response = $this->registerUser('second@example.test')->assertCreated();
        self::assertNotContains('admin', (array) $response->json('user.roles'));
    }

    public function test_audit_entries_do_not_contain_the_presented_token(): void
    {
        config(['trominal.setup_token' => self::SETUP_TOKEN]);

        $this->registerUser(overrides: ['setup_token' => 'setup-attempted-guess-value'])->assertForbidden();

        $serialised = AuditLog::query()->get()->toJson();
        self::assertStringNotContainsString('setup-attempted-guess-value', $serialised);
        self::assertStringNotContainsString(self::SETUP_TOKEN, $serialised);
    }
}
