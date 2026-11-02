<?php

declare(strict_types=1);

namespace App\Support\Network;

use Symfony\Component\HttpFoundation\IpUtils;

/**
 * Small helpers for handling textual IP addresses safely.
 */
final class IpAddress
{
    /**
     * Canonicalize an IPv4 or IPv6 literal. IPv4-mapped IPv6 addresses
     * (::ffff:a.b.c.d) collapse to their IPv4 form so that the same peer
     * always compares equal. Returns null for anything that is not a plain
     * address literal (hostnames, CIDRs, scoped/zone addresses, garbage).
     */
    public static function normalize(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $candidate = trim($value);

        if (str_starts_with($candidate, '[') && str_ends_with($candidate, ']')) {
            $candidate = substr($candidate, 1, -1);
        }

        if ($candidate === '' || str_contains($candidate, '%') || str_contains($candidate, '/')) {
            return null;
        }

        if (filter_var($candidate, FILTER_VALIDATE_IP) === false) {
            return null;
        }

        $packed = @inet_pton($candidate);

        if (! is_string($packed)) {
            return null;
        }

        if (strlen($packed) === 16 && str_starts_with($packed, str_repeat("\0", 10)."\xff\xff")) {
            $packed = substr($packed, 12);
        }

        $normalized = inet_ntop($packed);

        return is_string($normalized) ? $normalized : null;
    }

    /**
     * Packed (binary) form of a normalized address: 4 bytes for IPv4, 16 for IPv6.
     */
    public static function packed(string $value): ?string
    {
        $normalized = self::normalize($value);

        if ($normalized === null) {
            return null;
        }

        $packed = inet_pton($normalized);

        return is_string($packed) ? $packed : null;
    }

    public static function equals(?string $left, ?string $right): bool
    {
        $left = self::normalize($left);
        $right = self::normalize($right);

        return $left !== null && $right !== null && hash_equals($left, $right);
    }

    /**
     * @param  list<string>  $cidrs
     */
    public static function inAny(string $address, array $cidrs): bool
    {
        $normalized = self::normalize($address);

        if ($normalized === null || $cidrs === []) {
            return false;
        }

        return IpUtils::checkIp($normalized, $cidrs);
    }

    /**
     * Parse a comma-separated list of IP addresses / CIDR ranges. Entries
     * that are not a valid address or range are dropped, so a typo can only
     * ever make the list stricter, never broader. Wildcards are not supported.
     *
     * @param  string|array<array-key, mixed>|null  $value
     * @return list<string>
     */
    public static function parseCidrList(string|array|null $value): array
    {
        if ($value === null) {
            return [];
        }

        $entries = is_array($value) ? $value : explode(',', $value);
        $valid = [];

        foreach ($entries as $entry) {
            if (! is_string($entry)) {
                continue;
            }

            $cidr = self::normalizeCidr($entry);

            if ($cidr !== null) {
                $valid[] = $cidr;
            }
        }

        return array_values(array_unique($valid));
    }

    private static function normalizeCidr(string $entry): ?string
    {
        $entry = trim($entry);

        if ($entry === '') {
            return null;
        }

        if (! str_contains($entry, '/')) {
            return self::normalize($entry);
        }

        [$address, $prefix] = explode('/', $entry, 2);
        $normalized = self::normalize($address);

        if ($normalized === null || preg_match('/^\d{1,3}$/', $prefix) !== 1) {
            return null;
        }

        $bits = (int) $prefix;

        if ($bits > (str_contains($normalized, ':') ? 128 : 32)) {
            return null;
        }

        return $normalized.'/'.$bits;
    }
}
