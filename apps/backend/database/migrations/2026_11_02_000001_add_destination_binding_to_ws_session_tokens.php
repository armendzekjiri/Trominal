<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ws_session_tokens', function (Blueprint $table): void {
            // Keyed hash of the destination (host + port) the client stated
            // when requesting the token. Tokens without one are rejected.
            $table->string('destination_hash', 64)->nullable()->after('token_hash');
        });
    }

    public function down(): void
    {
        Schema::table('ws_session_tokens', function (Blueprint $table): void {
            $table->dropColumn('destination_hash');
        });
    }
};
