<?php

declare(strict_types=1);

namespace Tests\Feature\WebSsh;

use App\Models\AuditLog;
use App\Models\Host;
use App\Models\User;
use App\Models\WsSessionToken;
use App\Services\Ssh\Client\WebSshConnector;
use App\Services\Ssh\Egress\HostResolver;
use App\Services\Ssh\WebSshError;
use App\Services\Ssh\WebSshOpenResult;
use App\Services\Ssh\WebSshSessionOpener;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\WebSsh\FakeHostResolver;
use Tests\Support\WebSsh\FakeWebSshClient;
use Tests\Support\WebSsh\FakeWebSshConnector;
use Tests\Support\WebSsh\WebSshTestKit;
use Tests\TestCase;

final class WebSshDestinationBindingTest extends TestCase
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
        config(['trominal.web_ssh_allowed_cidrs' => '']);

        $this->user = WebSshTestKit::user();
        $this->host = WebSshTestKit::host($this->user);
        $this->hostKey = WebSshTestKit::hostKeyBlob();

        $this->resolver = new FakeHostResolver([
            'ssh.example.com' => ['93.184.216.34'],
            'rebind.example.com' => ['93.184.216.35'],
            'internal.example.com' => ['10.0.0.5'],
            'localhost' => ['127.0.0.1', '::1'],
            'metadata.example.com' => ['169.254.169.254'],
            'mixed.example.com' => ['10.0.0.9', '93.184.216.36'],
            'v6.example.com' => ['2606:4700:4700::1111'],
            'mapped.example.com' => ['::ffff:127.0.0.1'],
        ]);
        $this->client = new FakeWebSshClient('93.184.216.34', $this->hostKey);
        $this->connector = new FakeWebSshConnector($this->client);

        $this->app->instance(HostResolver::class, $this->resolver);
        $this->app->instance(WebSshConnector::class, $this->connector);
    }

    /**
     * @return array<string, array{array<string, mixed>, list<string>}>
     */
    public static function invalidTokenRequests(): array
    {
        return [
            'nothing' => [[], ['host_id', 'host', 'port']],
            'no destination' => [['host_id' => '{host}'], ['host', 'port']],
            'bad port' => [['host_id' => '{host}', 'host' => 'ssh.example.com', 'port' => 70000], ['port']],
            'bad host' => [['host_id' => '{host}', 'host' => 'user@ssh.example.com', 'port' => 22], ['host']],
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  list<string>  $errors
     */
    #[DataProvider('invalidTokenRequests')]
    public function test_requires_a_host_id_and_destination_when_issuing_a_token(array $payload, array $errors): void
    {
        $payload = array_map(fn (mixed $value): mixed => $value === '{host}' ? $this->host->id : $value, $payload);

        WebSshTestKit::requestToken($this, $this->user, $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors($errors);
    }

    public function test_stores_a_keyed_destination_hash_on_the_token_instead_of_the_plaintext_address(): void
    {
        $this->issueToken('ssh.example.com', 2222);

        $record = WsSessionToken::query()->firstOrFail();

        self::assertMatchesRegularExpression('/^[a-f0-9]{64}$/', (string) $record->destination_hash);
        self::assertSame($this->host->id, $record->host_id);
        self::assertStringNotContainsString('ssh.example.com', (string) json_encode($record->getAttributes()));
    }

    public function test_opens_a_session_to_the_bound_destination_over_the_resolved_public_address(): void
    {
        $result = $this->open($this->frame($this->issueToken()));

        self::assertSame(WebSshOpenResult::SESSION, $result->kind);
        self::assertSame([['93.184.216.34', 22]], $this->connector->connections);
        self::assertCount(1, $this->client->logins);

        $audit = AuditLog::query()->where('action', 'ssh.session.opened')->firstOrFail();
        $metadata = (array) $audit->metadata;

        self::assertSame($this->host->id, $audit->resource_id);
        self::assertSame('websocket', $metadata['transport']);
        self::assertSame(22, $metadata['port']);
        self::assertSame('public', $metadata['address_class']);
        self::assertSame(4, $metadata['ip_version']);
        self::assertFalse($metadata['allowlisted']);
        self::assertStringNotContainsString('correct horse', (string) json_encode($metadata));
        self::assertStringNotContainsString('93.184.216.34', (string) json_encode($metadata));
    }

    public function test_rejects_frames_without_a_host_id(): void
    {
        $frame = (array) json_decode($this->frame($this->issueToken()), true);
        unset($frame['host_id']);

        $this->assertWebSshError(fn () => $this->open((string) json_encode($frame)), WebSshError::INVALID_FRAME);

        self::assertSame([], $this->connector->connections);
    }

    public function test_rejects_frames_for_a_different_host_id(): void
    {
        $other = WebSshTestKit::host($this->user);

        $this->assertWebSshError(
            fn () => $this->open($this->frame($this->issueToken(), ['host_id' => $other->id])),
            WebSshError::DESTINATION_MISMATCH,
        );

        self::assertSame([], $this->connector->connections);
    }

    /**
     * @return array<string, array{array<string, mixed>}>
     */
    public static function mismatchedDestinations(): array
    {
        return [
            'other host' => [['host' => 'internal.example.com']],
            'other port' => [['port' => 2222]],
            'loopback literal' => [['host' => '127.0.0.1']],
        ];
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    #[DataProvider('mismatchedDestinations')]
    public function test_rejects_frames_whose_destination_differs_from_the_one_bound_at_issuance(array $overrides): void
    {
        $this->assertWebSshError(
            fn () => $this->open($this->frame($this->issueToken(), $overrides)),
            WebSshError::DESTINATION_MISMATCH,
        );

        self::assertSame([], $this->connector->connections);
        self::assertSame([], $this->resolver->lookups);
        self::assertSame('destination_mismatch', $this->deniedAudit()['reason']);
    }

    public function test_treats_equivalent_spellings_of_the_bound_destination_as_the_same_destination(): void
    {
        $result = $this->open($this->frame($this->issueToken('SSH.Example.com.'), ['host' => 'ssh.example.com']));

        self::assertSame(WebSshOpenResult::SESSION, $result->kind);
    }

    /**
     * @return array<string, array{string}>
     */
    public static function nonPublicNames(): array
    {
        return [
            'private' => ['internal.example.com'],
            'localhost' => ['localhost'],
            'metadata' => ['metadata.example.com'],
            'mapped loopback' => ['mapped.example.com'],
        ];
    }

    #[DataProvider('nonPublicNames')]
    public function test_denies_destinations_that_resolve_to_non_public_addresses(string $host): void
    {
        $this->assertWebSshError(
            fn () => $this->open($this->frame($this->issueToken($host), ['host' => $host])),
            WebSshError::DESTINATION_DENIED,
        );

        self::assertSame([], $this->connector->connections);

        $metadata = $this->deniedAudit();

        self::assertSame('destination_denied', $metadata['reason']);
        self::assertNotSame('public', $metadata['address_class']);
    }

    /**
     * @return array<string, array{string}>
     */
    public static function nonPublicLiterals(): array
    {
        return [
            'loopback' => ['127.0.0.1'],
            'metadata' => ['169.254.169.254'],
            'private' => ['10.1.2.3'],
            'cgnat' => ['100.64.0.1'],
            'unspecified' => ['0.0.0.0'],
            'ipv6 loopback' => ['::1'],
            'ula' => ['fd00::1'],
            'ipv6 link-local' => ['fe80::1'],
        ];
    }

    #[DataProvider('nonPublicLiterals')]
    public function test_denies_ip_literal_destinations_in_private_and_special_ranges(string $host): void
    {
        $this->resolver->records[$host] = [$host];

        $this->assertWebSshError(
            fn () => $this->open($this->frame($this->issueToken($host), ['host' => $host])),
            WebSshError::DESTINATION_DENIED,
        );

        self::assertSame([], $this->connector->connections);
    }

    public function test_connects_only_to_a_vetted_address_when_a_name_resolves_to_mixed_addresses(): void
    {
        $this->client->peer = '93.184.216.36';

        $this->open($this->frame($this->issueToken('mixed.example.com'), ['host' => 'mixed.example.com']));

        self::assertSame([['93.184.216.36', 22]], $this->connector->connections);
    }

    public function test_supports_public_ipv6_destinations(): void
    {
        $this->client->peer = '2606:4700:4700::1111';

        $this->open($this->frame($this->issueToken('v6.example.com'), ['host' => 'v6.example.com']));

        self::assertSame([['2606:4700:4700::1111', 22]], $this->connector->connections);

        $metadata = (array) AuditLog::query()->where('action', 'ssh.session.opened')->firstOrFail()->metadata;

        self::assertSame(6, $metadata['ip_version']);
        self::assertSame('public', $metadata['address_class']);
    }

    public function test_resolves_the_name_once_and_aborts_if_the_connected_peer_differs_from_the_vetted_address(): void
    {
        $this->client->peer = '127.0.0.1';

        $this->assertWebSshError(
            fn () => $this->open($this->frame($this->issueToken('rebind.example.com'), ['host' => 'rebind.example.com'])),
            WebSshError::DESTINATION_DENIED,
        );

        self::assertSame(['rebind.example.com'], $this->resolver->lookups);
        self::assertSame([['93.184.216.35', 22]], $this->connector->connections);
        self::assertSame([], $this->client->logins);
        self::assertTrue($this->client->disconnected);
    }

    public function test_aborts_when_the_connected_peer_address_cannot_be_determined(): void
    {
        $this->client->peer = null;

        $this->assertWebSshError(fn () => $this->open($this->frame($this->issueToken())), WebSshError::DESTINATION_DENIED);

        self::assertSame([], $this->client->logins);
    }

    public function test_fails_when_the_destination_does_not_resolve(): void
    {
        $this->assertWebSshError(
            fn () => $this->open($this->frame($this->issueToken('nxdomain.example.com'), ['host' => 'nxdomain.example.com'])),
            WebSshError::DESTINATION_UNRESOLVABLE,
        );

        self::assertSame([], $this->connector->connections);
    }

    public function test_allows_private_destinations_inside_an_explicitly_configured_allowlist(): void
    {
        config(['trominal.web_ssh_allowed_cidrs' => '10.0.0.0/24']);
        $this->client->peer = '10.0.0.5';

        $result = $this->open($this->frame($this->issueToken('internal.example.com'), ['host' => 'internal.example.com']));

        self::assertSame(WebSshOpenResult::SESSION, $result->kind);
        self::assertSame([['10.0.0.5', 22]], $this->connector->connections);

        $metadata = (array) AuditLog::query()->where('action', 'ssh.session.opened')->firstOrFail()->metadata;

        self::assertSame('private', $metadata['address_class']);
        self::assertTrue($metadata['allowlisted']);
    }

    public function test_rejects_sessions_when_web_ssh_was_disabled_after_the_token_was_issued(): void
    {
        $token = $this->issueToken();
        WebSshTestKit::disableWebSsh();

        $this->assertWebSshError(fn () => $this->open($this->frame($token)), WebSshError::WEB_SSH_DISABLED);

        self::assertSame([], $this->connector->connections);
    }

    public function test_rejects_an_invalid_reused_or_ip_mismatched_token_before_touching_the_network(): void
    {
        $token = $this->issueToken();

        $this->assertWebSshError(fn () => $this->open($this->frame($token), '198.51.100.20'), WebSshError::INVALID_TOKEN);
        $this->assertWebSshError(fn () => $this->open($this->frame(str_repeat('a', 64))), WebSshError::INVALID_TOKEN);
        $this->assertWebSshError(fn () => $this->open('{"type":"connect"}'), WebSshError::INVALID_TOKEN);
        $this->assertWebSshError(fn () => $this->open('not json'), WebSshError::INVALID_FRAME);

        $this->open($this->frame($token));
        $this->assertWebSshError(fn () => $this->open($this->frame($token)), WebSshError::INVALID_TOKEN);

        self::assertCount(1, $this->connector->connections);
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
     */
    private function frame(string $token, array $overrides = []): string
    {
        return json_encode(array_merge([
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
        ], $overrides), JSON_THROW_ON_ERROR);
    }

    private function open(string $payload, ?string $clientIp = '127.0.0.1'): WebSshOpenResult
    {
        return $this->app->make(WebSshSessionOpener::class)->open($payload, $clientIp);
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

    /**
     * @return array<string, mixed>
     */
    private function deniedAudit(): array
    {
        return (array) AuditLog::query()->where('action', 'ssh.session.denied')->firstOrFail()->metadata;
    }
}
