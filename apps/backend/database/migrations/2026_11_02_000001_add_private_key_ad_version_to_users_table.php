<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Track which associated data authenticates the user's private-key envelope:
     * 1 = legacy email address, 2 = immutable user ID. Existing rows are legacy
     * and are re-bound by the client on the next successful unlock.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->unsignedSmallInteger('private_key_ad_version')->default(1)->after('private_key_nonce');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('private_key_ad_version');
        });
    }
};
