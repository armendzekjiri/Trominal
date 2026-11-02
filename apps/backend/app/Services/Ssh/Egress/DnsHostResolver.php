<?php

declare(strict_types=1);

namespace App\Services\Ssh\Egress;

use App\Support\Network\IpAddress;

/**
 * Resolves destinations with the system resolver. IP literals are returned
 * as-is. IPv4 lookups go through getaddrinfo (so /etc/hosts and container
 * DNS apply); AAAA records are added from DNS.
 */
final class DnsHostResolver implements HostResolver
{
    public function resolve(string $host): array
    {
        $literal = IpAddress::normalize($host);

        if ($literal !== null) {
            return [$literal];
        }

        $addresses = [];
        $ipv4 = @gethostbynamel($host);

        if (is_array($ipv4)) {
            foreach ($ipv4 as $address) {
                $addresses[] = $address;
            }
        }

        $records = @dns_get_record($host, DNS_AAAA);

        if (is_array($records)) {
            foreach ($records as $record) {
                if (isset($record['ipv6']) && is_string($record['ipv6'])) {
                    $addresses[] = $record['ipv6'];
                }
            }
        }

        $normalized = [];

        foreach ($addresses as $address) {
            $value = IpAddress::normalize($address);

            if ($value !== null) {
                $normalized[] = $value;
            }
        }

        return array_values(array_unique($normalized));
    }
}
