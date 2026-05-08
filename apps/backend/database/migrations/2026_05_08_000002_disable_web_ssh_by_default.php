<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $this->setWebSshEnabled(false);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $this->setWebSshEnabled(true);
    }

    private function setWebSshEnabled(bool $enabled): void
    {
        $setting = DB::table('app_settings')
            ->where('key', 'registration')
            ->first();

        if ($setting === null || ! is_string($setting->value)) {
            return;
        }

        /** @var array<string, mixed> $value */
        $value = json_decode($setting->value, associative: true, flags: JSON_THROW_ON_ERROR);
        $value['web_ssh_enabled'] = $enabled;

        DB::table('app_settings')
            ->where('key', 'registration')
            ->update([
                'value' => json_encode($value, JSON_THROW_ON_ERROR),
                'updated_at' => now(),
            ]);
    }
};
