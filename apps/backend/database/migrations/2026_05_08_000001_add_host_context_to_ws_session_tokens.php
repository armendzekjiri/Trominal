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
            $table->foreignUlid('host_id')
                ->nullable()
                ->after('user_id')
                ->constrained('hosts')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('ws_session_tokens', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('host_id');
        });
    }
};
