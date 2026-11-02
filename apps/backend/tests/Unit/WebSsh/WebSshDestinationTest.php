<?php

declare(strict_types=1);

use App\Services\Ssh\WebSshDestination;

it('normalizes hostnames and IP literals', function (string $host, string $expected): void {
    expect(WebSshDestination::from($host, 22)->host)->toBe($expected);
})->with([
    'case and trailing dot' => ['Server.Example.COM.', 'server.example.com'],
    'whitespace' => ['  example.com ', 'example.com'],
    'ipv4' => ['203.0.113.9', '203.0.113.9'],
    'bracketed ipv6' => ['[2001:DB8::0:1]', '2001:db8::1'],
    'mapped ipv6' => ['::ffff:203.0.113.9', '203.0.113.9'],
]);

it('rejects invalid destinations', function (string $host, int $port): void {
    WebSshDestination::from($host, $port);
})->throws(InvalidArgumentException::class)->with([
    'empty host' => ['', 22],
    'path' => ['example.com/admin', 22],
    'userinfo' => ['user@example.com', 22],
    'embedded port' => ['example.com:22', 22],
    'space' => ['exa mple.com', 22],
    'scoped ipv6' => ['fe80::1%eth0', 22],
    'port zero' => ['example.com', 0],
    'port too large' => ['example.com', 65536],
    'too long' => [str_repeat('a.', 130).'com', 22],
]);

it('produces a keyed binding hash that depends on host and port', function (): void {
    $key = 'test-key';
    $a = WebSshDestination::from('example.com', 22)->bindingHash($key);

    expect($a)->toMatch('/^[a-f0-9]{64}$/')
        ->and(WebSshDestination::from('EXAMPLE.com.', 22)->bindingHash($key))->toBe($a)
        ->and(WebSshDestination::from('example.com', 2222)->bindingHash($key))->not->toBe($a)
        ->and(WebSshDestination::from('example.org', 22)->bindingHash($key))->not->toBe($a)
        ->and(WebSshDestination::from('example.com', 22)->bindingHash('other-key'))->not->toBe($a)
        ->and($a)->not->toContain('example');
});

it('matches binding hashes in constant time and rejects missing hashes', function (): void {
    $destination = WebSshDestination::from('example.com', 22);
    $hash = $destination->bindingHash('k');

    expect($destination->matches($hash, 'k'))->toBeTrue()
        ->and($destination->matches(null, 'k'))->toBeFalse()
        ->and($destination->matches('', 'k'))->toBeFalse()
        ->and(WebSshDestination::from('example.com', 23)->matches($hash, 'k'))->toBeFalse();
});

it('refuses to hash with an empty key', function (): void {
    WebSshDestination::from('example.com', 22)->bindingHash('');
})->throws(RuntimeException::class);
