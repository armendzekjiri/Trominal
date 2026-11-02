<?php

declare(strict_types=1);

use App\Services\Ssh\HostKeyFingerprint;

// Public keys and fingerprints as printed by `ssh-keygen -lf`.
const ED25519_PUBLIC_KEY = 'AAAAC3NzaC1lZDI1NTE5AAAAIEztwYkObpelDBpqEFI6FnUc+6UsJvLIbN/HYtekkXYB';
const ED25519_FINGERPRINT = 'SHA256:OvoVOrZkNf9UDcUwx4cY++1Dz+g+98WmJKb9B3C+j2g';
const ECDSA_PUBLIC_KEY = 'AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBFKtMcYgVc+vvT7IfUGAHib//NuYNGwlZeU7oYEpAirJBUd2xPe2OAt8g5SWwJoirJrAFiB1v2O7lG963Df6F2Q=';
const ECDSA_FINGERPRINT = 'SHA256:4wjNhg7/gaVDSqUJW4THt4WsoKHr/pwAQ0VbHWWRLm8';

it('computes OpenSSH SHA256 fingerprints from host key blobs', function (string $publicKey, string $fingerprint, string $type): void {
    $blob = base64_decode($publicKey, true);

    expect($blob)->toBeString();

    $hostKey = HostKeyFingerprint::fromBlob((string) $blob);

    expect($hostKey->fingerprint)->toBe($fingerprint)
        ->and($hostKey->keyType)->toBe($type);
})->with([
    'ed25519' => [ED25519_PUBLIC_KEY, ED25519_FINGERPRINT, 'ssh-ed25519'],
    'ecdsa' => [ECDSA_PUBLIC_KEY, ECDSA_FINGERPRINT, 'ecdsa-sha2-nistp256'],
]);

it('rejects blobs that are not SSH wire-format public keys', function (string $blob): void {
    HostKeyFingerprint::fromBlob($blob);
})->throws(InvalidArgumentException::class)->with([
    'empty' => [''],
    'truncated length' => ["\x00\x00"],
    'length beyond blob' => ["\x00\x00\x00\xffssh-ed25519"],
    'empty type' => ["\x00\x00\x00\x00rest"],
    'non-printable type' => ["\x00\x00\x00\x03a\x00b"],
]);

it('validates pinned fingerprint syntax', function (string $value, bool $valid): void {
    expect(HostKeyFingerprint::isWellFormed($value))->toBe($valid);
})->with([
    'openssh format' => [ED25519_FINGERPRINT, true],
    'with base64 padding' => [ED25519_FINGERPRINT.'=', true],
    'missing prefix' => [substr(ED25519_FINGERPRINT, 7), false],
    'md5 format' => ['MD5:16:27:ac:a5:76:28:2d:36:63:1b:56:4d:eb:df:a6:48', false],
    'lowercase prefix' => ['sha256:'.substr(ED25519_FINGERPRINT, 7), false],
    'too short' => ['SHA256:abc', false],
    'invalid characters' => ['SHA256:'.str_repeat('!', 43), false],
    'empty' => ['', false],
]);

it('compares a pinned fingerprint with the presented key', function (): void {
    $hostKey = HostKeyFingerprint::fromBlob((string) base64_decode(ED25519_PUBLIC_KEY, true));

    expect($hostKey->matches(ED25519_FINGERPRINT))->toBeTrue()
        ->and($hostKey->matches(ED25519_FINGERPRINT.'='))->toBeTrue()
        ->and($hostKey->matches(ECDSA_FINGERPRINT))->toBeFalse()
        ->and($hostKey->matches('SHA256:'.strtolower(substr(ED25519_FINGERPRINT, 7))))->toBeFalse()
        ->and($hostKey->matches('garbage'))->toBeFalse()
        ->and($hostKey->matches(''))->toBeFalse();
});
