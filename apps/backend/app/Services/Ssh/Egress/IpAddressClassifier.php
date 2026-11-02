<?php

declare(strict_types=1);

namespace App\Services\Ssh\Egress;

use App\Support\Network\IpAddress;
use InvalidArgumentException;

/**
 * Classifies IP literals by special-purpose range (IANA IPv4/IPv6
 * special-purpose registries). Anything outside the IPv6 global unicast
 * block 2000::/3 is treated as reserved, so unknown space is never public.
 */
final class IpAddressClassifier
{
    /**
     * IPv4 special-purpose ranges, as [network, prefix length, class].
     *
     * @var list<array{string, int, IpAddressClass}>
     */
    private const IPV4_RANGES = [
        ['0.0.0.0', 8, IpAddressClass::Unspecified],
        ['10.0.0.0', 8, IpAddressClass::Private],
        ['100.64.0.0', 10, IpAddressClass::SharedAddressSpace],
        ['127.0.0.0', 8, IpAddressClass::Loopback],
        ['169.254.0.0', 16, IpAddressClass::LinkLocal],
        ['172.16.0.0', 12, IpAddressClass::Private],
        ['192.0.0.0', 24, IpAddressClass::Reserved],
        ['192.0.2.0', 24, IpAddressClass::Reserved],
        ['192.88.99.0', 24, IpAddressClass::Reserved],
        ['192.168.0.0', 16, IpAddressClass::Private],
        ['198.18.0.0', 15, IpAddressClass::Reserved],
        ['198.51.100.0', 24, IpAddressClass::Reserved],
        ['203.0.113.0', 24, IpAddressClass::Reserved],
        ['224.0.0.0', 4, IpAddressClass::Multicast],
        ['240.0.0.0', 4, IpAddressClass::Reserved],
    ];

    /**
     * IPv6 special-purpose ranges that do not embed an IPv4 address.
     *
     * @var list<array{string, int, IpAddressClass}>
     */
    private const IPV6_RANGES = [
        ['::', 128, IpAddressClass::Unspecified],
        ['::1', 128, IpAddressClass::Loopback],
        ['::', 96, IpAddressClass::Reserved],
        ['64:ff9b:1::', 48, IpAddressClass::Private],
        ['100::', 64, IpAddressClass::Reserved],
        ['2001:db8::', 32, IpAddressClass::Reserved],
        ['2001::', 23, IpAddressClass::Reserved],
        ['3fff::', 20, IpAddressClass::Reserved],
        ['fc00::', 7, IpAddressClass::Private],
        ['fe80::', 10, IpAddressClass::LinkLocal],
        ['fec0::', 10, IpAddressClass::Private],
        ['ff00::', 8, IpAddressClass::Multicast],
    ];

    /**
     * @throws InvalidArgumentException when the value is not a plain IP literal.
     */
    public static function classify(string $address): IpAddressClass
    {
        $packed = IpAddress::packed($address);

        if ($packed === null) {
            throw new InvalidArgumentException('Not an IP address literal.');
        }

        return strlen($packed) === 4 ? self::classifyV4($packed) : self::classifyV6($packed);
    }

    private static function classifyV4(string $packed): IpAddressClass
    {
        foreach (self::IPV4_RANGES as [$network, $prefix, $class]) {
            if (self::inRange($packed, $network, $prefix)) {
                return $class;
            }
        }

        return IpAddressClass::Public;
    }

    private static function classifyV6(string $packed): IpAddressClass
    {
        // NAT64 well-known prefix (64:ff9b::/96) and 6to4 (2002::/16) route to
        // an embedded IPv4 address; classify by that address so private IPv4
        // space cannot be reached through a translator or relay.
        if (self::inRange($packed, '64:ff9b::', 96)) {
            return self::classifyV4(substr($packed, 12, 4));
        }

        if (self::inRange($packed, '2002::', 16)) {
            return self::classifyV4(substr($packed, 2, 4));
        }

        foreach (self::IPV6_RANGES as [$network, $prefix, $class]) {
            if (self::inRange($packed, $network, $prefix)) {
                return $class;
            }
        }

        if (! self::inRange($packed, '2000::', 3)) {
            return IpAddressClass::Reserved;
        }

        return IpAddressClass::Public;
    }

    private static function inRange(string $packed, string $network, int $prefix): bool
    {
        $networkPacked = inet_pton($network);

        if (! is_string($networkPacked) || strlen($networkPacked) !== strlen($packed)) {
            return false;
        }

        $fullBytes = intdiv($prefix, 8);
        $remainingBits = $prefix % 8;

        if (substr($packed, 0, $fullBytes) !== substr($networkPacked, 0, $fullBytes)) {
            return false;
        }

        if ($remainingBits === 0) {
            return true;
        }

        $mask = (0xFF << (8 - $remainingBits)) & 0xFF;

        return (ord($packed[$fullBytes]) & $mask) === (ord($networkPacked[$fullBytes]) & $mask);
    }
}
