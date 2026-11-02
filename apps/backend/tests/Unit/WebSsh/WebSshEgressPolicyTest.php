<?php

declare(strict_types=1);

use App\Services\Ssh\Egress\IpAddressClass;
use App\Services\Ssh\Egress\WebSshEgressPolicy;

it('allows public addresses by default', function (string $address): void {
    $decision = (new WebSshEgressPolicy([]))->evaluate($address);

    expect($decision->allowed)->toBeTrue()
        ->and($decision->addressClass)->toBe(IpAddressClass::Public)
        ->and($decision->allowlisted)->toBeFalse();
})->with(['8.8.8.8', '2001:4860:4860::8888', '::ffff:1.1.1.1']);

it('denies non-public addresses by default', function (string $address): void {
    expect((new WebSshEgressPolicy([]))->evaluate($address)->allowed)->toBeFalse();
})->with([
    '127.0.0.1', '::1', '0.0.0.0', '::', '10.0.0.5', '172.20.0.2', '192.168.0.1',
    '100.64.1.1', '169.254.169.254', 'fe80::1', 'fd00::1', 'ff02::1', '224.0.0.1',
    '::ffff:127.0.0.1', '::ffff:169.254.169.254', '64:ff9b::a00:1', '2002:a00:1::1',
    '192.0.2.1', '2001:db8::1',
]);

it('denies invalid addresses', function (): void {
    $decision = (new WebSshEgressPolicy(['0.0.0.0/0']))->evaluate('not-an-ip');

    expect($decision->allowed)->toBeFalse()
        ->and($decision->addressClass)->toBe(IpAddressClass::Invalid);
});

it('allows private addresses inside an explicitly allowlisted range', function (): void {
    $policy = new WebSshEgressPolicy(['10.20.0.0/16', 'fd00:1234::/32']);

    expect($policy->evaluate('10.20.3.4')->allowed)->toBeTrue()
        ->and($policy->evaluate('10.20.3.4')->allowlisted)->toBeTrue()
        ->and($policy->evaluate('10.20.3.4')->addressClass)->toBe(IpAddressClass::Private)
        ->and($policy->evaluate('::ffff:10.20.3.4')->allowed)->toBeTrue()
        ->and($policy->evaluate('fd00:1234::9')->allowed)->toBeTrue()
        ->and($policy->evaluate('10.21.0.1')->allowed)->toBeFalse()
        ->and($policy->evaluate('fd00:1235::9')->allowed)->toBeFalse();
});

it('never allows unspecified or multicast destinations even when allowlisted', function (string $address): void {
    $policy = new WebSshEgressPolicy(['0.0.0.0/0', '::/0']);

    expect($policy->evaluate($address)->allowed)->toBeFalse();
})->with(['0.0.0.0', '::', '224.0.0.1', 'ff02::1', '::ffff:0.0.0.0']);

it('ignores malformed allowlist entries instead of widening the policy', function (): void {
    $policy = WebSshEgressPolicy::fromList('*, 10.0.0.0/99, nonsense, 192.168.10.0/24');

    expect($policy->evaluate('10.0.0.1')->allowed)->toBeFalse()
        ->and($policy->evaluate('192.168.10.7')->allowed)->toBeTrue()
        ->and($policy->evaluate('192.168.11.7')->allowed)->toBeFalse();
});
