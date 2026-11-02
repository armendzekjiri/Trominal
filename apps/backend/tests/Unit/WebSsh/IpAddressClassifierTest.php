<?php

declare(strict_types=1);

use App\Services\Ssh\Egress\IpAddressClass;
use App\Services\Ssh\Egress\IpAddressClassifier;

it('classifies IPv4 addresses', function (string $address, IpAddressClass $expected): void {
    expect(IpAddressClassifier::classify($address))->toBe($expected);
})->with([
    'unspecified' => ['0.0.0.0', IpAddressClass::Unspecified],
    'this network' => ['0.1.2.3', IpAddressClass::Unspecified],
    'loopback' => ['127.0.0.1', IpAddressClass::Loopback],
    'loopback range' => ['127.255.255.254', IpAddressClass::Loopback],
    'rfc1918 10/8' => ['10.0.0.1', IpAddressClass::Private],
    'rfc1918 10/8 upper' => ['10.255.255.255', IpAddressClass::Private],
    'rfc1918 172.16/12' => ['172.16.0.1', IpAddressClass::Private],
    'rfc1918 172.16/12 upper' => ['172.31.255.255', IpAddressClass::Private],
    'just outside 172.16/12' => ['172.32.0.1', IpAddressClass::Public],
    'rfc1918 192.168/16' => ['192.168.1.10', IpAddressClass::Private],
    'cgnat' => ['100.64.0.1', IpAddressClass::SharedAddressSpace],
    'cgnat upper' => ['100.127.255.255', IpAddressClass::SharedAddressSpace],
    'just outside cgnat' => ['100.128.0.1', IpAddressClass::Public],
    'link-local' => ['169.254.1.1', IpAddressClass::LinkLocal],
    'cloud metadata' => ['169.254.169.254', IpAddressClass::LinkLocal],
    'ietf protocol assignments' => ['192.0.0.8', IpAddressClass::Reserved],
    'documentation 1' => ['192.0.2.1', IpAddressClass::Reserved],
    'documentation 2' => ['198.51.100.1', IpAddressClass::Reserved],
    'documentation 3' => ['203.0.113.1', IpAddressClass::Reserved],
    'benchmarking' => ['198.18.0.1', IpAddressClass::Reserved],
    'multicast' => ['224.0.0.1', IpAddressClass::Multicast],
    'multicast upper' => ['239.255.255.255', IpAddressClass::Multicast],
    'reserved class e' => ['240.0.0.1', IpAddressClass::Reserved],
    'broadcast' => ['255.255.255.255', IpAddressClass::Reserved],
    'public dns' => ['8.8.8.8', IpAddressClass::Public],
    'public' => ['1.1.1.1', IpAddressClass::Public],
    'public near private' => ['11.0.0.1', IpAddressClass::Public],
]);

it('classifies IPv6 addresses', function (string $address, IpAddressClass $expected): void {
    expect(IpAddressClassifier::classify($address))->toBe($expected);
})->with([
    'unspecified' => ['::', IpAddressClass::Unspecified],
    'loopback' => ['::1', IpAddressClass::Loopback],
    'loopback expanded' => ['0:0:0:0:0:0:0:1', IpAddressClass::Loopback],
    'bracketed loopback' => ['[::1]', IpAddressClass::Loopback],
    'link-local' => ['fe80::1', IpAddressClass::LinkLocal],
    'link-local upper' => ['febf:ffff::1', IpAddressClass::LinkLocal],
    'site-local (deprecated)' => ['fec0::1', IpAddressClass::Private],
    'unique local fc' => ['fc00::1', IpAddressClass::Private],
    'unique local fd' => ['fd12:3456:789a::1', IpAddressClass::Private],
    'aws ipv6 metadata' => ['fd00:ec2::254', IpAddressClass::Private],
    'multicast' => ['ff02::1', IpAddressClass::Multicast],
    'multicast global' => ['ff0e::1', IpAddressClass::Multicast],
    'documentation' => ['2001:db8::1', IpAddressClass::Reserved],
    'documentation 3fff' => ['3fff::1', IpAddressClass::Reserved],
    'teredo' => ['2001:0:4136:e378:8000:63bf:3fff:fdd2', IpAddressClass::Reserved],
    'discard' => ['100::1', IpAddressClass::Reserved],
    'ipv4-compatible (deprecated)' => ['::7f00:1', IpAddressClass::Reserved],
    'nat64 local-use' => ['64:ff9b:1::1', IpAddressClass::Private],
    'outside global unicast' => ['4000::1', IpAddressClass::Reserved],
    'public google' => ['2001:4860:4860::8888', IpAddressClass::Public],
    'public cloudflare' => ['2606:4700:4700::1111', IpAddressClass::Public],
]);

it('classifies IPv4 embedded in IPv6 by the embedded address', function (string $address, IpAddressClass $expected): void {
    expect(IpAddressClassifier::classify($address))->toBe($expected);
})->with([
    'mapped loopback' => ['::ffff:127.0.0.1', IpAddressClass::Loopback],
    'mapped loopback hex' => ['::ffff:7f00:1', IpAddressClass::Loopback],
    'mapped metadata' => ['::ffff:169.254.169.254', IpAddressClass::LinkLocal],
    'mapped private' => ['::ffff:10.1.2.3', IpAddressClass::Private],
    'mapped unspecified' => ['::ffff:0.0.0.0', IpAddressClass::Unspecified],
    'mapped public' => ['::ffff:8.8.8.8', IpAddressClass::Public],
    'nat64 private' => ['64:ff9b::10.0.0.1', IpAddressClass::Private],
    'nat64 loopback' => ['64:ff9b::7f00:1', IpAddressClass::Loopback],
    'nat64 public' => ['64:ff9b::8.8.8.8', IpAddressClass::Public],
    '6to4 private' => ['2002:c0a8:0101::1', IpAddressClass::Private],
    '6to4 loopback' => ['2002:7f00:0001::1', IpAddressClass::Loopback],
    '6to4 public' => ['2002:0808:0808::1', IpAddressClass::Public],
]);

it('rejects values that are not plain IP literals', function (string $value): void {
    IpAddressClassifier::classify($value);
})->throws(InvalidArgumentException::class)->with([
    'hostname' => ['localhost'],
    'empty' => [''],
    'cidr' => ['10.0.0.0/8'],
    'zone id' => ['fe80::1%eth0'],
    'octal-looking' => ['0177.0.0.1'],
    'decimal integer' => ['2130706433'],
    'short form' => ['127.1'],
    'with port' => ['127.0.0.1:22'],
]);
