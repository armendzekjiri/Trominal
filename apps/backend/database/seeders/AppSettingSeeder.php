<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\AppSetting;
use Illuminate\Database\Seeder;

final class AppSettingSeeder extends Seeder
{
    /**
     * Seed the application's settings.
     */
    public function run(): void
    {
        AppSetting::query()->updateOrCreate(
            ['key' => AppSetting::REGISTRATION],
            ['value' => AppSetting::defaultRegistrationValue()],
        );
    }
}
