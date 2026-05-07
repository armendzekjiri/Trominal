<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->unsignedBigInteger('vault_version')->default(1)->after('two_fa_enabled_at');
        });

        Schema::create('groups', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->ulid('user_id');
            $table->ulid('parent_id')->nullable();
            $table->text('name_ciphertext');
            $table->string('name_nonce', 128);
            $table->text('color_ciphertext')->nullable();
            $table->string('color_nonce', 128)->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'updated_at']);
            $table->index(['user_id', 'deleted_at']);
        });

        Schema::create('hosts', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->ulid('user_id');
            $table->ulid('group_id')->nullable();
            $table->text('name_ciphertext');
            $table->string('name_nonce', 128);
            $table->text('hostname_ciphertext');
            $table->string('hostname_nonce', 128);
            $table->text('port_ciphertext')->nullable();
            $table->string('port_nonce', 128)->nullable();
            $table->text('username_ciphertext')->nullable();
            $table->string('username_nonce', 128)->nullable();
            $table->text('tags_ciphertext')->nullable();
            $table->string('tags_nonce', 128)->nullable();
            $table->text('color_ciphertext')->nullable();
            $table->string('color_nonce', 128)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'updated_at']);
            $table->index(['user_id', 'deleted_at']);
        });

        Schema::create('snippets', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->ulid('user_id');
            $table->text('title_ciphertext');
            $table->string('title_nonce', 128);
            $table->text('body_ciphertext');
            $table->string('body_nonce', 128);
            $table->text('tags_ciphertext')->nullable();
            $table->string('tags_nonce', 128)->nullable();
            $table->text('variables_ciphertext')->nullable();
            $table->string('variables_nonce', 128)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'updated_at']);
            $table->index(['user_id', 'deleted_at']);
        });

        Schema::create('identities', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->ulid('user_id');
            $table->text('name_ciphertext');
            $table->string('name_nonce', 128);
            $table->string('key_type')->nullable();
            $table->text('public_key_ciphertext')->nullable();
            $table->string('public_key_nonce', 128)->nullable();
            $table->text('private_key_ciphertext');
            $table->string('private_key_nonce', 128);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'updated_at']);
            $table->index(['user_id', 'deleted_at']);
        });

        Schema::create('tunnels', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->ulid('user_id');
            $table->ulid('host_id')->nullable();
            $table->text('name_ciphertext');
            $table->string('name_nonce', 128);
            $table->text('config_ciphertext');
            $table->string('config_nonce', 128);
            $table->boolean('enabled')->default(false);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'updated_at']);
            $table->index(['user_id', 'deleted_at']);
        });

        Schema::create('ai_settings', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->ulid('user_id')->unique();
            $table->text('provider_ciphertext')->nullable();
            $table->string('provider_nonce', 128)->nullable();
            $table->text('model_ciphertext')->nullable();
            $table->string('model_nonce', 128)->nullable();
            $table->text('api_key_ciphertext')->nullable();
            $table->string('api_key_nonce', 128)->nullable();
            $table->text('settings_ciphertext')->nullable();
            $table->string('settings_nonce', 128)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'updated_at']);
            $table->index(['user_id', 'deleted_at']);
        });

        Schema::create('host_credentials', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->ulid('user_id');
            $table->ulid('host_id')->nullable();
            $table->ulid('identity_id')->nullable();
            $table->text('label_ciphertext');
            $table->string('label_nonce', 128);
            $table->text('username_ciphertext')->nullable();
            $table->string('username_nonce', 128)->nullable();
            $table->text('password_ciphertext')->nullable();
            $table->string('password_nonce', 128)->nullable();
            $table->text('private_key_passphrase_ciphertext')->nullable();
            $table->string('private_key_passphrase_nonce', 128)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'updated_at']);
            $table->index(['user_id', 'deleted_at']);
        });

        Schema::table('groups', function (Blueprint $table): void {
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('parent_id')->references('id')->on('groups')->nullOnDelete();
        });

        Schema::table('hosts', function (Blueprint $table): void {
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('group_id')->references('id')->on('groups')->nullOnDelete();
        });

        Schema::table('snippets', function (Blueprint $table): void {
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::table('identities', function (Blueprint $table): void {
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::table('tunnels', function (Blueprint $table): void {
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('host_id')->references('id')->on('hosts')->nullOnDelete();
        });

        Schema::table('ai_settings', function (Blueprint $table): void {
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::table('host_credentials', function (Blueprint $table): void {
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('host_id')->references('id')->on('hosts')->nullOnDelete();
            $table->foreign('identity_id')->references('id')->on('identities')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('host_credentials');
        Schema::dropIfExists('ai_settings');
        Schema::dropIfExists('tunnels');
        Schema::dropIfExists('identities');
        Schema::dropIfExists('snippets');
        Schema::dropIfExists('hosts');
        Schema::dropIfExists('groups');

        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('vault_version');
        });
    }
};
