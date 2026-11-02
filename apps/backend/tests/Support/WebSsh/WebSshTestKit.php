<?php

declare(strict_types=1);

namespace Tests\Support\WebSsh;

use App\Models\AppSetting;
use App\Models\Host;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Helpers shared by the web SSH feature tests.
 */
final class WebSshTestKit
{
    public static function enableWebSsh(): void
    {
        AppSetting::registration()->update([
            'value' => [
                'mode' => 'single',
                'open' => false,
                'instance_name' => 'Trominal',
                'web_ssh_enabled' => true,
            ],
        ]);
    }

    public static function disableWebSsh(): void
    {
        AppSetting::registration()->update([
            'value' => [
                'mode' => 'single',
                'open' => false,
                'instance_name' => 'Trominal',
                'web_ssh_enabled' => false,
            ],
        ]);
    }

    public static function user(): User
    {
        $user = User::factory()->create();
        $user->assignRole('user');

        return $user;
    }

    public static function host(User $user): Host
    {
        /** @var Host $host */
        $host = Host::query()->create([
            'user_id' => $user->id,
            'name_ciphertext' => 'host-name-ciphertext',
            'name_nonce' => 'host-name-nonce',
            'hostname_ciphertext' => 'host-address-ciphertext',
            'hostname_nonce' => 'host-address-nonce',
        ]);

        return $host;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return TestResponse<JsonResponse>
     */
    public static function requestToken(TestCase $test, User $user, array $payload): TestResponse
    {
        return $test->postJson('/api/v1/ws/ssh-token', $payload, [
            'Authorization' => 'Bearer '.$user->createToken('web ssh test')->plainTextToken,
        ]);
    }

    /**
     * A syntactically valid SSH wire-format public host key blob.
     */
    public static function hostKeyBlob(string $type = 'ssh-ed25519', ?string $material = null): string
    {
        $material ??= random_bytes(32);

        return pack('N', strlen($type)).$type.pack('N', strlen($material)).$material;
    }

    public static function fingerprint(string $blob): string
    {
        return 'SHA256:'.rtrim(base64_encode(hash('sha256', $blob, true)), '=');
    }
}
