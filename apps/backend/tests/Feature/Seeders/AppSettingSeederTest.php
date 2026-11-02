<?php

declare(strict_types=1);

namespace Tests\Feature\Seeders;

use App\Models\AppSetting;
use Database\Seeders\AppSettingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class AppSettingSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeds_default_registration_setting_on_empty_database(): void
    {
        $this->seed(AppSettingSeeder::class);

        self::assertSame(AppSetting::defaultRegistrationValue(), AppSetting::registration()->value);
    }

    public function test_reseeding_does_not_reopen_closed_registration(): void
    {
        AppSetting::setRegistration([
            ...AppSetting::defaultRegistrationValue(),
            'open' => false,
        ]);

        $this->seed(AppSettingSeeder::class);

        self::assertFalse(AppSetting::registration()->value['open']);
    }
}
