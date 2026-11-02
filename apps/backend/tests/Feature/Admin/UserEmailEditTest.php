<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Filament\Resources\Users\Pages\EditUser;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Features\SupportTesting\Testable;
use Livewire\Livewire;
use Tests\TestCase;

/**
 * A legacy account's private-key envelope is authenticated with its email
 * address, so the admin panel must not change that email until the user's
 * client has re-bound the envelope to the immutable user ID.
 */
final class UserEmailEditTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
        Filament::setCurrentPanel('admin');
    }

    public function test_email_is_locked_for_accounts_whose_envelope_is_still_email_bound(): void
    {
        $admin = $this->admin();
        $legacy = User::factory()->create();
        $legacy->forceFill(['private_key_ad_version' => 1])->save();

        $this->editUserPage($admin, $legacy)->assertFormFieldDisabled('email');
    }

    public function test_email_is_editable_once_the_envelope_is_bound_to_the_user_id(): void
    {
        $admin = $this->admin();
        $migrated = User::factory()->create();
        $migrated->forceFill(['private_key_ad_version' => 2])->save();

        $this->editUserPage($admin, $migrated)->assertFormFieldEnabled('email');
    }

    /**
     * @return Testable<EditUser>
     */
    private function editUserPage(User $admin, User $record): Testable
    {
        /** @var Testable<EditUser> $page */
        $page = Livewire::actingAs($admin)->test(EditUser::class, ['record' => $record->getRouteKey()]);

        return $page;
    }

    private function admin(): User
    {
        /** @var User $admin */
        $admin = User::factory()->create([
            'two_fa_enabled_at' => now(),
            'two_fa_secret_enc' => 'TESTTOTPSECRET',
        ]);
        $admin->forceFill(['private_key_ad_version' => 2])->save();
        $admin->assignRole('admin');

        return $admin;
    }
}
