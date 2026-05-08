<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teams', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('created_by_user_id')->constrained('users')->cascadeOnDelete();
            $table->text('name_ciphertext');
            $table->string('name_nonce', 128);
            $table->unsignedBigInteger('key_version')->default(1);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['created_by_user_id', 'updated_at']);
            $table->index(['deleted_at']);
        });

        Schema::create('team_members', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('team_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 16);
            $table->text('wrapped_team_key_ciphertext');
            $table->string('wrapped_team_key_nonce', 128);
            $table->unsignedBigInteger('key_version')->default(1);
            $table->timestamps();

            $table->unique(['team_id', 'user_id']);
            $table->index(['user_id', 'updated_at']);
            $table->index(['team_id', 'role']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('team_members');
        Schema::dropIfExists('teams');
    }
};
