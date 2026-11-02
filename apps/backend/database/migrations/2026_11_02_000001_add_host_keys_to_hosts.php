<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Approved SSH host-key pins, encrypted client-side like every other host
 * field. Nullable so existing hosts stay valid until the user approves a
 * fingerprint on the next connect.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hosts', function (Blueprint $table): void {
            $table->text('host_keys_ciphertext')->nullable()->after('color_nonce');
            $table->string('host_keys_nonce', 128)->nullable()->after('host_keys_ciphertext');
        });
    }

    public function down(): void
    {
        Schema::table('hosts', function (Blueprint $table): void {
            $table->dropColumn(['host_keys_ciphertext', 'host_keys_nonce']);
        });
    }
};
