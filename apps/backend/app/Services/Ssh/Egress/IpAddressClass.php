<?php

declare(strict_types=1);

namespace App\Services\Ssh\Egress;

enum IpAddressClass: string
{
    case Public = 'public';
    case Loopback = 'loopback';
    case LinkLocal = 'link_local';
    case Private = 'private';
    case SharedAddressSpace = 'shared_address_space';
    case Unspecified = 'unspecified';
    case Multicast = 'multicast';
    case Reserved = 'reserved';
    case Invalid = 'invalid';
}
