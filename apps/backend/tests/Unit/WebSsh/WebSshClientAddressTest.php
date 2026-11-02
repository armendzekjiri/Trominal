<?php

declare(strict_types=1);

use App\Services\Ssh\WebSshClientAddress;

it('uses the peer address and ignores forwarding headers when no proxy is trusted', function (): void {
    $resolver = new WebSshClientAddress([]);

    expect($resolver->resolve('203.0.113.7', '198.51.100.1'))->toBe('203.0.113.7');
});

it('ignores forwarding headers sent by an untrusted peer', function (): void {
    $resolver = new WebSshClientAddress(['10.0.0.0/8']);

    expect($resolver->resolve('203.0.113.7', '198.51.100.1, 10.0.0.2'))->toBe('203.0.113.7');
});

it('uses the forwarded client address when the peer is a trusted proxy', function (): void {
    $resolver = new WebSshClientAddress(['172.16.0.0/12']);

    expect($resolver->resolve('172.18.0.5', '198.51.100.1'))->toBe('198.51.100.1');
});

it('takes the right-most untrusted forwarded address so client-supplied entries are ignored', function (): void {
    $resolver = new WebSshClientAddress(['172.16.0.0/12', '192.0.2.10']);

    expect($resolver->resolve('172.18.0.5', '127.0.0.1, 198.51.100.1, 192.0.2.10'))->toBe('198.51.100.1');
});

it('falls back to the trusted peer when no forwarding header is present', function (): void {
    $resolver = new WebSshClientAddress(['172.16.0.0/12']);

    expect($resolver->resolve('172.18.0.5', ''))->toBe('172.18.0.5');
});

it('fails closed on a malformed forwarding header from a trusted proxy', function (): void {
    $resolver = new WebSshClientAddress(['172.16.0.0/12']);

    expect($resolver->resolve('172.18.0.5', 'not-an-ip'))->toBeNull()
        ->and($resolver->resolve('172.18.0.5', '198.51.100.1, garbage'))->toBeNull();
});

it('returns null when the peer address is missing or invalid', function (): void {
    $resolver = new WebSshClientAddress(['172.16.0.0/12']);

    expect($resolver->resolve(null, '198.51.100.1'))->toBeNull()
        ->and($resolver->resolve('', '198.51.100.1'))->toBeNull()
        ->and($resolver->resolve('nope', '198.51.100.1'))->toBeNull();
});

it('normalizes IPv4-mapped IPv6 and IPv6 peers', function (): void {
    $resolver = new WebSshClientAddress(['fd00::/8']);

    expect($resolver->resolve('::ffff:203.0.113.7', ''))->toBe('203.0.113.7')
        ->and($resolver->resolve('fd00::1', '2001:DB8::0:1'))->toBe('2001:db8::1');
});

it('extracts the peer address from a socket remote address', function (?string $remote, ?string $expected): void {
    expect(WebSshClientAddress::peerFromRemoteAddress($remote))->toBe($expected);
})->with([
    'ipv4' => ['tcp://203.0.113.7:51234', '203.0.113.7'],
    'ipv6' => ['tcp://[2001:db8::1]:51234', '2001:db8::1'],
    'tls ipv4' => ['tls://198.51.100.2:443', '198.51.100.2'],
    'null' => [null, null],
    'unix socket' => ['unix:///tmp/socket', null],
    'garbage' => ['tcp://not-an-ip:1', null],
]);
