<?php

declare(strict_types=1);

namespace App\Services\Ssh;

use App\Support\Network\IpAddress;

/**
 * Determines the client address of a web SSH WebSocket connection.
 *
 * Forwarding headers are only honoured when the immediate TCP peer is a
 * configured trusted proxy; otherwise the peer address itself is used. A
 * malformed header from a trusted proxy yields null so that IP binding fails
 * closed instead of silently falling back to a guess.
 */
final class WebSshClientAddress
{
    /**
     * @param  list<string>  $trustedProxies  IP addresses / CIDR ranges.
     */
    public function __construct(private readonly array $trustedProxies)
    {
        //
    }

    public static function fromConfig(): self
    {
        /** @var string|array<array-key, mixed>|null $configured */
        $configured = config('trominal.web_ssh_trusted_proxies');

        return new self(IpAddress::parseCidrList($configured));
    }

    public function resolve(?string $peerAddress, string $forwardedFor): ?string
    {
        $peer = IpAddress::normalize($peerAddress);

        if ($peer === null) {
            return null;
        }

        if (! $this->isTrusted($peer)) {
            return $peer;
        }

        $forwardedFor = trim($forwardedFor);

        if ($forwardedFor === '') {
            return $peer;
        }

        // Walk from the closest hop outwards: entries appended by trusted
        // proxies are skipped, and the first untrusted hop is the client.
        // Anything further left was supplied by the client and is ignored.
        $hops = array_reverse(explode(',', $forwardedFor));
        $candidate = $peer;

        foreach ($hops as $hop) {
            $address = IpAddress::normalize($hop);

            if ($address === null) {
                return null;
            }

            $candidate = $address;

            if (! $this->isTrusted($address)) {
                return $address;
            }
        }

        return $candidate;
    }

    /**
     * Extract the IP address from a socket remote address such as
     * "tcp://203.0.113.7:51234" or "tcp://[2001:db8::1]:51234".
     */
    public static function peerFromRemoteAddress(?string $remoteAddress): ?string
    {
        if ($remoteAddress === null || $remoteAddress === '') {
            return null;
        }

        $address = preg_replace('#^[a-z]+://#i', '', $remoteAddress) ?? '';

        if (preg_match('/^\[([^\]]+)\]:\d+$/', $address, $matches) === 1) {
            return IpAddress::normalize($matches[1]);
        }

        if (preg_match('/^([^:]+):\d+$/', $address, $matches) === 1) {
            return IpAddress::normalize($matches[1]);
        }

        return IpAddress::normalize($address);
    }

    private function isTrusted(string $address): bool
    {
        return IpAddress::inAny($address, $this->trustedProxies);
    }
}
