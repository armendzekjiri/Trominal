<?php

declare(strict_types=1);

namespace App\Services\Ssh\Egress;

final class EgressDecision
{
    public function __construct(
        public readonly bool $allowed,
        public readonly ?string $address,
        public readonly IpAddressClass $addressClass,
        public readonly bool $allowlisted,
    ) {
        //
    }

    public function ipVersion(): ?int
    {
        if ($this->address === null) {
            return null;
        }

        return str_contains($this->address, ':') ? 6 : 4;
    }

    /**
     * Destination metadata that is safe to record in the audit log: the class
     * of address and IP version, never the address itself.
     *
     * @return array{address_class: string, ip_version: int|null, allowlisted: bool}
     */
    public function auditMetadata(): array
    {
        return [
            'address_class' => $this->addressClass->value,
            'ip_version' => $this->ipVersion(),
            'allowlisted' => $this->allowlisted,
        ];
    }
}
