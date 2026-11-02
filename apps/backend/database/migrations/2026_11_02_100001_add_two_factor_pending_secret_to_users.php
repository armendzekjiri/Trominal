<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A new TOTP enrollment is staged in its own column so the active factor
     * (`two_fa_secret_enc` + `two_fa_enabled_at`) is never touched until the
     * new secret has been confirmed with a valid code.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->text('two_fa_pending_secret_enc')->nullable()->after('two_fa_secret_enc');
        });

        // Enrollments that were started but never confirmed used to live in the
        // active column. Both columns use the same `encrypted` cast, so the
        // ciphertext can be moved as-is.
        DB::table('users')
            ->whereNull('two_fa_enabled_at')
            ->whereNotNull('two_fa_secret_enc')
            ->update([
                'two_fa_pending_secret_enc' => DB::raw('two_fa_secret_enc'),
                'two_fa_secret_enc' => null,
            ]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('two_fa_pending_secret_enc');
        });
    }
};
