<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Refresh tokens issued by one sign-in share a `family_id` across every
     * rotation, and access tokens remember the device they were issued to, so
     * a replayed refresh token can revoke everything that descends from it.
     */
    public function up(): void
    {
        Schema::table('refresh_tokens', function (Blueprint $table): void {
            $table->ulid('family_id')->nullable()->after('device_id')->index();
        });

        // Existing tokens become the root of their own family.
        DB::table('refresh_tokens')->whereNull('family_id')->update(['family_id' => DB::raw('id')]);

        Schema::table('personal_access_tokens', function (Blueprint $table): void {
            $table->foreignUlid('device_id')->nullable()->after('tokenable_id')
                ->constrained('devices')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('personal_access_tokens', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('device_id');
        });

        Schema::table('refresh_tokens', function (Blueprint $table): void {
            $table->dropIndex(['family_id']);
            $table->dropColumn('family_id');
        });
    }
};
