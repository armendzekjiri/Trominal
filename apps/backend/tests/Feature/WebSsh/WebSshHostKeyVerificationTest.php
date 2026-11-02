<?php

declare(strict_types=1);

namespace Tests\Feature\WebSsh;

use App\Models\AuditLog;
use App\Models\Host;
use App\Models\User;
use App\Services\Ssh\Client\WebSshConnector;
use App\Services\Ssh\Egress\HostResolver;
use App\Services\Ssh\WebSshError;
use App\Services\Ssh\WebSshOpenResult;
use App\Services\Ssh\WebSshSessionOpener;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\WebSsh\FakeHostResolver;
use Tests\Support\WebSsh\FakeWebSshClient;
use Tests\Support\WebSsh\FakeWebSshConnector;
use Tests\Support\WebSsh\WebSshTestKit;
use Tests\TestCase;

final class WebSshHostKeyVerificationTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Host $host;

    private string $hostKey;

    private FakeHostResolver $resolver;

    private FakeWebSshClient $client;

    private FakeWebSshConnector $connector;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
        WebSshTestKit::enableWebSsh();

        $this->user = WebSshTestKit::user();
        $this->host = WebSshTestKit::host($this->user);
        $this->hostKey = WebSshTestKit::hostKeyBlob('ssh-ed25519');

        $this->resolver = new FakeHostResolver([
            'ssh.example.com' => ['93.184.216.34'],
            'internal.example.com' => ['10.0.0.5'],
        ]);
        $this->client = new FakeWebSshClient('93.184.216.34', $this->hostKey);
        $this->connector = new FakeWebSshConnector($this->client);

        $this->app->instance(HostResolver::class, $this->resolver);
        $this->app->instance(WebSshConnector::class, $this->connector);
    }

    public function test_connect_without_a_pinned_fingerprint_is_rejected_before_any_network_access(): void
    {
        $frame = $this->connectFrame($this->issueToken());
        unset($frame['host_key_fingerprint']);

        $this->assertWebSshError(fn () => $this->open($frame), WebSshError::HOST_KEY_UNKNOWN);

        self::assertSame([], $this->connector->connections);
        self::assertSame([], $this->client->logins);
    }

    public function test_connect_with_a_malformed_fingerprint_is_rejected(): void
    {
        $frame = $this->connectFrame($this->issueToken(), ['host_key_fingerprint' => 'MD5:16:27:ac:a5:76:28:2d:36']);

        $this->assertWebSshError(fn () => $this->open($frame), WebSshError::INVALID_FRAME);

        self::assertSame([], $this->connector->connections);
    }

    public function test_connect_with_the_pinned_fingerprint_verifies_the_host_key_before_authenticating(): void
    {
        $result = $this->open($this->connectFrame($this->issueToken()));

        self::assertSame(WebSshOpenResult::SESSION, $result->kind);
        self::assertSame(WebSshTestKit::fingerprint($this->hostKey), $result->fingerprint);
        self::assertSame('ssh-ed25519', $result->keyType);

        $hostKeyCheck = $this->client->callIndex('serverHostKey');
        $login = $this->client->callIndex('login');

        self::assertNotNull($hostKeyCheck);
        self::assertNotNull($login);
        self::assertLessThan($login, $hostKeyCheck);

        $metadata = (array) AuditLog::query()->where('action', 'ssh.session.opened')->firstOrFail()->metadata;

        self::assertSame('ssh-ed25519', $metadata['host_key_type']);
        self::assertSame(WebSshTestKit::fingerprint($this->hostKey), $metadata['host_key_fingerprint']);
    }

    public function test_connect_accepts_a_padded_fingerprint(): void
    {
        $frame = $this->connectFrame($this->issueToken(), [
            'host_key_fingerprint' => WebSshTestKit::fingerprint($this->hostKey).'=',
        ]);

        self::assertSame(WebSshOpenResult::SESSION, $this->open($frame)->kind);
    }

    public function test_host_key_mismatch_aborts_without_sending_credentials(): void
    {
        $presented = WebSshTestKit::hostKeyBlob('ssh-ed25519');
        $this->client->hostKeyBlob = $presented;

        $error = $this->assertWebSshError(
            fn () => $this->open($this->connectFrame($this->issueToken())),
            WebSshError::HOST_KEY_MISMATCH,
        );

        self::assertSame([], $this->client->logins);
        self::assertTrue($this->client->disconnected);

        $frame = $error->toFrame();

        self::assertSame('error', $frame['type']);
        self::assertSame('host_key_mismatch', $frame['code']);
        self::assertSame(WebSshTestKit::fingerprint($presented), $frame['fingerprint']);
        self::assertSame('ssh-ed25519', $frame['key_type']);

        $metadata = (array) AuditLog::query()->where('action', 'ssh.session.denied')->firstOrFail()->metadata;

        self::assertSame('host_key_mismatch', $metadata['reason']);
        self::assertStringNotContainsString('correct horse', (string) json_encode($metadata));
    }

    public function test_a_rotated_key_of_a_different_algorithm_is_treated_as_a_mismatch(): void
    {
        $this->client->hostKeyBlob = WebSshTestKit::hostKeyBlob('ecdsa-sha2-nistp256', random_bytes(65));

        $error = $this->assertWebSshError(
            fn () => $this->open($this->connectFrame($this->issueToken())),
            WebSshError::HOST_KEY_MISMATCH,
        );

        self::assertSame('ecdsa-sha2-nistp256', $error->toFrame()['key_type']);
        self::assertSame([], $this->client->logins);
    }

    public function test_private_key_credentials_are_not_used_when_the_host_key_mismatches(): void
    {
        $this->client->hostKeyBlob = WebSshTestKit::hostKeyBlob();

        $frame = $this->connectFrame($this->issueToken(), [
            'auth' => ['kind' => 'private-key', 'private_key_pem_b64' => base64_encode('-----BEGIN OPENSSH PRIVATE KEY-----')],
        ]);

        $this->assertWebSshError(fn () => $this->open($frame), WebSshError::HOST_KEY_MISMATCH);

        self::assertSame([], $this->client->logins);
    }

    public function test_a_server_without_a_verifiable_host_key_is_rejected(): void
    {
        $this->client->hostKeyBlob = null;

        $this->assertWebSshError(
            fn () => $this->open($this->connectFrame($this->issueToken())),
            WebSshError::HOST_KEY_UNAVAILABLE,
        );

        self::assertSame([], $this->client->logins);
        self::assertTrue($this->client->disconnected);
    }

    public function test_a_malformed_host_key_blob_is_rejected(): void
    {
        $this->client->hostKeyBlob = 'not a key';

        $this->assertWebSshError(
            fn () => $this->open($this->connectFrame($this->issueToken())),
            WebSshError::HOST_KEY_UNAVAILABLE,
        );

        self::assertSame([], $this->client->logins);
    }

    public function test_probe_returns_the_presented_host_key_without_authenticating(): void
    {
        $result = $this->open($this->probeFrame($this->issueToken()));

        self::assertSame(WebSshOpenResult::PROBE, $result->kind);
        self::assertNull($result->client);
        self::assertSame(WebSshTestKit::fingerprint($this->hostKey), $result->fingerprint);
        self::assertSame('ssh-ed25519', $result->keyType);
        self::assertSame([], $this->client->logins);
        self::assertTrue($this->client->disconnected);

        $audit = AuditLog::query()->where('action', 'ssh.host_key.probed')->firstOrFail();
        $metadata = (array) $audit->metadata;

        self::assertSame($this->host->id, $audit->resource_id);
        self::assertSame('ssh-ed25519', $metadata['host_key_type']);
        self::assertSame('public', $metadata['address_class']);
    }

    public function test_probe_then_connect_with_the_approved_fingerprint(): void
    {
        $probe = $this->open($this->probeFrame($this->issueToken()));

        $result = $this->open($this->connectFrame($this->issueToken(), [
            'host_key_fingerprint' => $probe->fingerprint,
        ]));

        self::assertSame(WebSshOpenResult::SESSION, $result->kind);
    }

    public function test_probe_tokens_are_single_use(): void
    {
        $token = $this->issueToken();

        $this->open($this->probeFrame($token));

        $this->assertWebSshError(fn () => $this->open($this->connectFrame($token)), WebSshError::INVALID_TOKEN);
    }

    public function test_probe_is_bound_to_the_token_destination_and_the_egress_policy(): void
    {
        $this->assertWebSshError(
            fn () => $this->open($this->probeFrame($this->issueToken(), ['port' => 2222])),
            WebSshError::DESTINATION_MISMATCH,
        );

        $this->assertWebSshError(
            fn () => $this->open($this->probeFrame($this->issueToken('internal.example.com'), ['host' => 'internal.example.com'])),
            WebSshError::DESTINATION_DENIED,
        );

        self::assertSame([], $this->connector->connections);
    }

    public function test_probe_ignores_credentials_sent_with_it(): void
    {
        $result = $this->open($this->probeFrame($this->issueToken(), [
            'auth' => ['kind' => 'password', 'password' => 'should not be used'],
            'username' => 'root',
        ]));

        self::assertSame(WebSshOpenResult::PROBE, $result->kind);
        self::assertSame([], $this->client->logins);
    }

    private function issueToken(string $host = 'ssh.example.com', int $port = 22): string
    {
        return (string) WebSshTestKit::requestToken($this, $this->user, [
            'host_id' => $this->host->id,
            'host' => $host,
            'port' => $port,
        ])->assertCreated()->json('token');
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function connectFrame(string $token, array $overrides = []): array
    {
        return array_merge([
            'type' => 'connect',
            'token' => $token,
            'host_id' => $this->host->id,
            'host' => 'ssh.example.com',
            'port' => 22,
            'username' => 'deploy',
            'cols' => 80,
            'rows' => 24,
            'host_key_fingerprint' => WebSshTestKit::fingerprint($this->hostKey),
            'auth' => ['kind' => 'password', 'password' => 'correct horse battery staple'],
        ], $overrides);
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function probeFrame(string $token, array $overrides = []): array
    {
        return array_merge([
            'type' => 'probe',
            'token' => $token,
            'host_id' => $this->host->id,
            'host' => 'ssh.example.com',
            'port' => 22,
        ], $overrides);
    }

    /**
     * @param  array<string, mixed>  $frame
     */
    private function open(array $frame, ?string $clientIp = '127.0.0.1'): WebSshOpenResult
    {
        return $this->app->make(WebSshSessionOpener::class)->open(json_encode($frame, JSON_THROW_ON_ERROR), $clientIp);
    }

    /**
     * @param  callable(): mixed  $callback
     */
    private function assertWebSshError(callable $callback, string $code): WebSshError
    {
        try {
            $callback();
        } catch (WebSshError $error) {
            self::assertSame($code, $error->errorCode);

            return $error;
        }

        self::fail("Expected web SSH error [{$code}] was not raised.");
    }
}
