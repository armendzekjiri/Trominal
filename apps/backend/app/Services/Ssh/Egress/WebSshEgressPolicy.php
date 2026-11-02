<?php

declare(strict_types=1);

namespace App\Services\Ssh\Egress;

use App\Support\Network\IpAddress;
use InvalidArgumentException;

/**
 * Decides which resolved addresses the web SSH proxy may connect to.
 *
 * Public unicast addresses are allowed. Loopback, link-local (including
 * cloud metadata endpoints), private, shared (CGNAT) and reserved space is
 * denied unless it falls inside an operator-configured allowlist.
 * Unspecified and multicast addresses are never valid SSH destinations.
 */
final class WebSshEgressPolicy
{
    /**
     * @param  list<string>  $allowedCidrs
     */
    public function __construct(private readonly array $allowedCidrs)
    {
        //
    }

    public static function fromConfig(): self
    {
        /** @var string|array<array-key, mixed>|null $configured */
        $configured = config('trominal.web_ssh_allowed_cidrs');

        return self::fromList($configured);
    }

    /**
     * @param  string|array<array-key, mixed>|null  $cidrs
     */
    public static function fromList(string|array|null $cidrs): self
    {
        return new self(IpAddress::parseCidrList($cidrs));
    }

    public function evaluate(string $address): EgressDecision
    {
        $normalized = IpAddress::normalize($address);

        if ($normalized === null) {
            return new EgressDecision(false, null, IpAddressClass::Invalid, false);
        }

        try {
            $class = IpAddressClassifier::classify($normalized);
        } catch (InvalidArgumentException) {
            return new EgressDecision(false, null, IpAddressClass::Invalid, false);
        }

        if ($class === IpAddressClass::Unspecified || $class === IpAddressClass::Multicast) {
            return new EgressDecision(false, $normalized, $class, false);
        }

        if ($class === IpAddressClass::Public) {
            return new EgressDecision(true, $normalized, $class, false);
        }

        $allowlisted = IpAddress::inAny($normalized, $this->allowedCidrs);

        return new EgressDecision($allowlisted, $normalized, $class, $allowlisted);
    }
}
