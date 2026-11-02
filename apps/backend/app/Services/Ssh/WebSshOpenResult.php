<?php

declare(strict_types=1);

namespace App\Services\Ssh;

use App\Models\WsSessionToken;
use App\Services\Ssh\Client\WebSshClient;

final class WebSshOpenResult
{
    public const PROBE = 'probe';

    public const SESSION = 'session';

    private function __construct(
        public readonly string $kind,
        public readonly WsSessionToken $token,
        public readonly ?string $fingerprint,
        public readonly ?string $keyType,
        public readonly ?WebSshClient $client,
    ) {
        //
    }

    public static function probe(WsSessionToken $token, string $fingerprint, string $keyType): self
    {
        return new self(self::PROBE, $token, $fingerprint, $keyType, null);
    }

    public static function session(WsSessionToken $token, WebSshClient $client, ?string $fingerprint, ?string $keyType): self
    {
        return new self(self::SESSION, $token, $fingerprint, $keyType, $client);
    }
}
