<?php

declare(strict_types=1);

use App\Models\AuditLog;
use App\Models\WsSessionToken;
use App\Services\Ssh\Client\WebSshConnector;
use App\Services\Ssh\Egress\HostResolver;
use App\Services\Ssh\WebSshError;
use App\Services\Ssh\WebSshSessionOpener;
use Database\Seeders\RoleAndPermissionSeeder;
use Tests\Support\WebSsh\FakeHostResolver;
use Tests\Support\WebSsh\FakeWebSshClient;
use Tests\Support\WebSsh\FakeWebSshConnector;
use Tests\Support\WebSsh\WebSshTestKit;

beforeEach(function (): void {
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

    app()->instance(HostResolver::class, $this->resolver);
    app()->instance(WebSshConnector::class, $this->connector);

    $this->token = function (string $host = 'ssh.example.com', int $port = 22): string {
        return (string) WebSshTestKit::requestToken($this, $this->user, [
            'host_id' => $this->host->id,
            'host' => $host,
            'port' => $port,
        ])->assertCreated()->json('token');
    };

    $this->frame = function (string $token, array $overrides = []): string {
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
    };

    $this->open = function (string $payload, ?string $clientIp = '127.0.0.1') {
        return app(WebSshSessionOpener::class)->open($payload, $clientIp);
    };

    $this->expectError = function (callable $callback, string $code): WebSshError {
        try {
            $callback();
        } catch (WebSshError $error) {
            expect($error->errorCode)->toBe($code);

            return $error;
        }

        throw new RuntimeException("Expected web SSH error [{$code}] was not raised.");
    };
});

it('requires a host id and destination when issuing a token', function (array $payload, array $errors): void {
    WebSshTestKit::requestToken($this, $this->user, $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors($errors);
})->with([
    'nothing' => [[], ['host_id', 'host', 'port']],
    'no destination' => [fn () => ['host_id' => $this->host->id], ['host', 'port']],
    'bad port' => [fn () => ['host_id' => $this->host->id, 'host' => 'ssh.example.com', 'port' => 70000], ['port']],
    'bad host' => [fn () => ['host_id' => $this->host->id, 'host' => 'user@ssh.example.com', 'port' => 22], ['host']],
]);

it('stores a keyed destination hash on the token instead of the plaintext address', function (): void {
    ($this->token)('ssh.example.com', 2222);

    $record = WsSessionToken::query()->firstOrFail();

    expect($record->destination_hash)->toMatch('/^[a-f0-9]{64}$/')
        ->and($record->host_id)->toBe($this->host->id)
        ->and(json_encode($record->getAttributes()))->not->toContain('ssh.example.com');
});

it('opens a session to the bound destination over the resolved public address', function (): void {
    $result = ($this->open)(($this->frame)(($this->token)()));

    expect($result->kind)->toBe('session')
        ->and($this->connector->connections)->toBe([['93.184.216.34', 22]])
        ->and($this->client->logins)->toHaveCount(1);

    $audit = AuditLog::query()->where('action', 'ssh.session.opened')->firstOrFail();

    expect($audit->resource_id)->toBe($this->host->id)
        ->and($audit->metadata)->toMatchArray([
            'transport' => 'websocket',
            'port' => 22,
            'address_class' => 'public',
            'ip_version' => 4,
            'allowlisted' => false,
        ])
        ->and(json_encode($audit->metadata))->not->toContain('correct horse')
        ->and(json_encode($audit->metadata))->not->toContain('93.184.216.34');
});

it('rejects frames without a host id', function (): void {
    $token = ($this->token)();
    $frame = json_decode(($this->frame)($token), true);
    unset($frame['host_id']);

    ($this->expectError)(fn () => ($this->open)(json_encode($frame)), 'invalid_frame');

    expect($this->connector->connections)->toBe([]);
});

it('rejects frames for a different host id', function (): void {
    $other = WebSshTestKit::host($this->user);

    ($this->expectError)(fn () => ($this->open)(($this->frame)(($this->token)(), ['host_id' => $other->id])), 'destination_mismatch');

    expect($this->connector->connections)->toBe([]);
});

it('rejects frames whose destination differs from the one bound at issuance', function (array $overrides): void {
    ($this->expectError)(fn () => ($this->open)(($this->frame)(($this->token)(), $overrides)), 'destination_mismatch');

    expect($this->connector->connections)->toBe([])
        ->and($this->resolver->lookups)->toBe([])
        ->and(AuditLog::query()->where('action', 'ssh.session.denied')->value('metadata'))
        ->toMatchArray(['reason' => 'destination_mismatch']);
})->with([
    'other host' => [['host' => 'internal.example.com']],
    'other port' => [['port' => 2222]],
    'loopback literal' => [['host' => '127.0.0.1']],
]);

it('treats equivalent spellings of the bound destination as the same destination', function (): void {
    $result = ($this->open)(($this->frame)(($this->token)('SSH.Example.com.'), ['host' => 'ssh.example.com']));

    expect($result->kind)->toBe('session');
});

it('denies destinations that resolve to non-public addresses', function (string $host): void {
    ($this->expectError)(fn () => ($this->open)(($this->frame)(($this->token)($host), ['host' => $host])), 'destination_denied');

    expect($this->connector->connections)->toBe([]);

    $audit = AuditLog::query()->where('action', 'ssh.session.denied')->firstOrFail();

    expect($audit->metadata['reason'])->toBe('destination_denied')
        ->and($audit->metadata['address_class'])->not->toBe('public');
})->with(['internal.example.com', 'localhost', 'metadata.example.com', 'mapped.example.com']);

it('denies IP literal destinations in private and special ranges', function (string $host): void {
    $this->resolver->records[$host] = [$host];

    ($this->expectError)(fn () => ($this->open)(($this->frame)(($this->token)($host), ['host' => $host])), 'destination_denied');

    expect($this->connector->connections)->toBe([]);
})->with(['127.0.0.1', '169.254.169.254', '10.1.2.3', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1']);

it('connects only to a vetted address when a name resolves to mixed addresses', function (): void {
    $this->client->peer = '93.184.216.36';

    ($this->open)(($this->frame)(($this->token)('mixed.example.com'), ['host' => 'mixed.example.com']));

    expect($this->connector->connections)->toBe([['93.184.216.36', 22]]);
});

it('supports public IPv6 destinations', function (): void {
    $this->client->peer = '2606:4700:4700::1111';

    ($this->open)(($this->frame)(($this->token)('v6.example.com'), ['host' => 'v6.example.com']));

    expect($this->connector->connections)->toBe([['2606:4700:4700::1111', 22]])
        ->and(AuditLog::query()->where('action', 'ssh.session.opened')->value('metadata'))
        ->toMatchArray(['ip_version' => 6, 'address_class' => 'public']);
});

it('resolves the name once and aborts if the connected peer differs from the vetted address', function (): void {
    $this->client->peer = '127.0.0.1';

    ($this->expectError)(fn () => ($this->open)(($this->frame)(($this->token)('rebind.example.com'), ['host' => 'rebind.example.com'])), 'destination_denied');

    expect($this->resolver->lookups)->toBe(['rebind.example.com'])
        ->and($this->connector->connections)->toBe([['93.184.216.35', 22]])
        ->and($this->client->logins)->toBe([])
        ->and($this->client->disconnected)->toBeTrue();
});

it('aborts when the connected peer address cannot be determined', function (): void {
    $this->client->peer = null;

    ($this->expectError)(fn () => ($this->open)(($this->frame)(($this->token)())), 'destination_denied');

    expect($this->client->logins)->toBe([]);
});

it('fails when the destination does not resolve', function (): void {
    ($this->expectError)(fn () => ($this->open)(($this->frame)(($this->token)('nxdomain.example.com'), ['host' => 'nxdomain.example.com'])), 'destination_unresolvable');

    expect($this->connector->connections)->toBe([]);
});

it('allows private destinations inside an explicitly configured allowlist', function (): void {
    config(['trominal.web_ssh_allowed_cidrs' => '10.0.0.0/24']);
    $this->client->peer = '10.0.0.5';

    $result = ($this->open)(($this->frame)(($this->token)('internal.example.com'), ['host' => 'internal.example.com']));

    expect($result->kind)->toBe('session')
        ->and($this->connector->connections)->toBe([['10.0.0.5', 22]])
        ->and(AuditLog::query()->where('action', 'ssh.session.opened')->value('metadata'))
        ->toMatchArray(['address_class' => 'private', 'allowlisted' => true]);
});

it('rejects sessions when web SSH was disabled after the token was issued', function (): void {
    $token = ($this->token)();
    WebSshTestKit::disableWebSsh();

    ($this->expectError)(fn () => ($this->open)(($this->frame)($token)), 'web_ssh_disabled');

    expect($this->connector->connections)->toBe([]);
});

it('rejects an invalid, reused or IP-mismatched token before touching the network', function (): void {
    $token = ($this->token)();

    ($this->expectError)(fn () => ($this->open)(($this->frame)($token), '198.51.100.20'), 'invalid_token');
    ($this->expectError)(fn () => ($this->open)(($this->frame)(str_repeat('a', 64))), 'invalid_token');
    ($this->expectError)(fn () => ($this->open)('{"type":"connect"}'), 'invalid_token');
    ($this->expectError)(fn () => ($this->open)('not json'), 'invalid_frame');

    ($this->open)(($this->frame)($token));
    ($this->expectError)(fn () => ($this->open)(($this->frame)($token)), 'invalid_token');

    expect($this->connector->connections)->toHaveCount(1);
});
