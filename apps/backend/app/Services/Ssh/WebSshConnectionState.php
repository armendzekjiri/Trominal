<?php

declare(strict_types=1);

namespace App\Services\Ssh;

use App\Models\WsSessionToken;
use phpseclib3\Net\SSH2;
use React\EventLoop\TimerInterface;

/**
 * Mutable per-connection state shared by the WebSocket proxy callbacks.
 *
 * @internal
 */
final class WebSshConnectionState
{
    public bool $handshakeStarted = false;

    public ?TimerInterface $handshakeTimer = null;

    public ?WsSessionToken $token = null;

    public ?SSH2 $ssh = null;

    public ?TimerInterface $readTimer = null;
}
