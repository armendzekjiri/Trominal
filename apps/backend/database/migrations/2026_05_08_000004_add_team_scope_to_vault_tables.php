<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var list<string> */
    private const array TABLES = [
        'groups',
        'hosts',
        'snippets',
        'identities',
        'tunnels',
        'host_credentials',
    ];

    public function up(): void
    {
        foreach (self::TABLES as $tableName) {
            Schema::table($tableName, function (Blueprint $table): void {
                $table->foreignUlid('team_id')->nullable()->after('user_id')->constrained()->cascadeOnDelete();
                $table->index(['team_id', 'updated_at']);
                $table->index(['team_id', 'deleted_at']);
            });
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $tableName) {
            Schema::table($tableName, function (Blueprint $table) use ($tableName): void {
                $table->dropForeign(['team_id']);
                $table->dropIndex($tableName.'_team_id_updated_at_index');
                $table->dropIndex($tableName.'_team_id_deleted_at_index');
                $table->dropColumn('team_id');
            });
        }
    }
};
