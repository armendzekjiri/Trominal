<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Models\AppSetting;
use App\Models\Host;
use App\Models\User;
use App\Models\WsSessionToken;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Symfony\Component\HttpFoundation\Response;
use Tests\TestCase;

final class TransportSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
        AppSetting::registration()->update([
            'value' => [
                'mode' => 'single',
                'open' => false,
                'instance_name' => 'Trominal',
                'web_ssh_enabled' => true,
            ],
        ]);
        config(['trominal.web_ssh_proxy_url' => null]);
    }

    public function test_websocket_url_is_wss_for_https_requests(): void
    {
        $response = $this->requestToken('https://trominal.example.com');

        self::assertSame('wss://trominal.example.com/ws/ssh', $this->websocketUrl($response));
    }

    public function test_websocket_url_is_wss_in_production_even_if_tls_ends_upstream(): void
    {
        $this->app['env'] = 'production';

        $response = $this->requestToken('http://trominal.example.com');

        self::assertSame('wss://trominal.example.com/ws/ssh', $this->websocketUrl($response));
    }

    public function test_production_still_allows_ws_for_local_development_hosts(): void
    {
        $this->app['env'] = 'production';

        $response = $this->requestToken('http://localhost:8031');

        self::assertSame('ws://localhost:8031/ws/ssh', $this->websocketUrl($response));
    }

    public function test_forwarded_headers_from_a_trusted_proxy_are_honoured(): void
    {
        config(['trustedproxy.proxies' => '10.0.0.0/8,172.16.0.0/12,192.168.0.0/16']);

        $response = $this->requestToken('http://trominal.example.com', [
            'REMOTE_ADDR' => '172.18.0.5',
            'HTTP_X_FORWARDED_PROTO' => 'https',
            'HTTP_X_FORWARDED_FOR' => '198.51.100.7',
        ]);

        self::assertStringStartsWith('wss://', $this->websocketUrl($response));
        self::assertSame('198.51.100.7', WsSessionToken::query()->firstOrFail()->ip_address);
    }

    public function test_forwarded_headers_from_untrusted_clients_are_ignored(): void
    {
        config(['trustedproxy.proxies' => '10.0.0.0/8,172.16.0.0/12,192.168.0.0/16']);

        $response = $this->requestToken('http://trominal.example.com', [
            'REMOTE_ADDR' => '203.0.113.9',
            'HTTP_X_FORWARDED_PROTO' => 'https',
            'HTTP_X_FORWARDED_FOR' => '198.51.100.7',
        ]);

        self::assertStringStartsWith('ws://', $this->websocketUrl($response));
        self::assertSame('203.0.113.9', WsSessionToken::query()->firstOrFail()->ip_address);
    }

    public function test_no_proxy_is_trusted_unless_configured(): void
    {
        config(['trustedproxy.proxies' => null]);

        $response = $this->requestToken('http://trominal.example.com', [
            'REMOTE_ADDR' => '172.18.0.5',
            'HTTP_X_FORWARDED_PROTO' => 'https',
            'HTTP_X_FORWARDED_FOR' => '198.51.100.7',
        ]);

        self::assertStringStartsWith('ws://', $this->websocketUrl($response));
        self::assertSame('172.18.0.5', WsSessionToken::query()->firstOrFail()->ip_address);
    }

    public function test_session_cookies_default_to_secure_in_production(): void
    {
        self::assertTrue($this->sessionConfigFor(['APP_ENV' => 'production'])['secure']);
        self::assertFalse($this->sessionConfigFor(['APP_ENV' => 'local'])['secure']);
        self::assertFalse($this->sessionConfigFor([
            'APP_ENV' => 'production',
            'SESSION_SECURE_COOKIE' => 'false',
        ])['secure']);
    }

    /**
     * @param  array<string, string>  $server
     * @return TestResponse<Response>
     */
    private function requestToken(string $origin, array $server = []): TestResponse
    {
        $user = User::factory()->create();
        $user->assignRole('user');

        /** @var Host $host */
        $host = Host::query()->create([
            'user_id' => $user->id,
            'name_ciphertext' => 'host-name-ciphertext',
            'name_nonce' => 'host-name-nonce',
            'hostname_ciphertext' => 'host-address-ciphertext',
            'hostname_nonce' => 'host-address-nonce',
        ]);

        $token = $user->createToken('transport test')->plainTextToken;

        return $this->withServerVariables($server)
            ->postJson($origin.'/api/v1/ws/ssh-token', ['host_id' => $host->id, 'host' => 'ssh.example.com', 'port' => 22], [
                'Authorization' => 'Bearer '.$token,
            ])
            ->assertCreated();
    }

    /**
     * @param  TestResponse<Response>  $response
     */
    private function websocketUrl(TestResponse $response): string
    {
        return (string) $response->json('websocket_url');
    }

    /**
     * Evaluate config/session.php against a given environment.
     *
     * @param  array<string, string>  $env
     * @return array<string, mixed>
     */
    private function sessionConfigFor(array $env): array
    {
        $keys = ['APP_ENV', 'SESSION_SECURE_COOKIE'];
        $saved = [];
        foreach ($keys as $key) {
            $saved[$key] = [$_ENV[$key] ?? null, $_SERVER[$key] ?? null, getenv($key)];
            unset($_ENV[$key], $_SERVER[$key]);
            putenv($key);
        }

        try {
            foreach ($env as $key => $value) {
                $_ENV[$key] = $value;
                $_SERVER[$key] = $value;
                putenv($key.'='.$value);
            }

            /** @var array<string, mixed> $config */
            $config = require config_path('session.php');

            return $config;
        } finally {
            foreach ($saved as $key => [$envValue, $serverValue, $processValue]) {
                unset($_ENV[$key], $_SERVER[$key]);
                putenv($key);
                if ($envValue !== null) {
                    $_ENV[$key] = $envValue;
                }
                if ($serverValue !== null) {
                    $_SERVER[$key] = $serverValue;
                }
                if ($processValue !== false) {
                    putenv($key.'='.$processValue);
                }
            }
        }
    }
}
