<?php

declare(strict_types=1);

namespace App\Services\Ssh;

use App\Models\AuditLog;
use App\Models\WsSessionToken;
use App\Services\Ssh\Client\WebSshClient;
use Laravel\Reverb\Servers\Reverb\Connection as WebSocketConnection;
use Laravel\Reverb\Servers\Reverb\Http\Response;
use Psr\Http\Message\RequestInterface;
use Ratchet\RFC6455\Messaging\DataInterface;
use Ratchet\RFC6455\Messaging\Frame;
use React\EventLoop\Loop;
use React\EventLoop\TimerInterface;
use Throwable;

/**
 * WebSocket endpoint for web SSH.
 *
 * Protocol (client → server, first text frame, JSON):
 *   connect: {type:"connect", token, host_id, host, port, username, cols, rows, auth}
 * Server → client control frames (JSON text):
 *   {type:"ready"} once the shell is open, or
 *   {type:"error", code, message} followed by close.
 * After "ready", binary/text frames carry terminal data; {type:"resize"} frames resize.
 */
final class WebSshProxy
{
    private const HANDSHAKE_TIMEOUT_SECONDS = 10.0;

    public function __construct(
        private readonly WebSshSessionOpener $opener,
        private readonly WebSshClientAddress $clientAddress,
    ) {
        //
    }

    public function __invoke(RequestInterface $request, mixed $connection): ?Response
    {
        if (! $connection instanceof WebSocketConnection) {
            return new Response([
                'message' => 'WebSocket upgrade required.',
            ], 426);
        }

        $ipAddress = $this->clientAddress->resolve(
            WebSshClientAddress::peerFromRemoteAddress($this->remoteAddress($connection)),
            $request->getHeaderLine('X-Forwarded-For'),
        );

        $connection->withMaxMessageSize(1024 * 1024);

        $state = new WebSshConnectionState;

        // The session token arrives in the first frame, never in the URL.
        // Connections that do not present one in time are closed.
        $state->handshakeTimer = Loop::addTimer(self::HANDSHAKE_TIMEOUT_SECONDS, function () use ($connection, $state): void {
            $state->handshakeTimer = null;

            if (! $state->handshakeStarted) {
                $this->sendError($connection, WebSshError::make(WebSshError::INVALID_TOKEN));
                $connection->close();
            }
        });

        $connection->onMessage(function (DataInterface $message) use ($connection, $ipAddress, $state): void {
            if (! $state->handshakeStarted) {
                $state->handshakeStarted = true;
                $this->cancelHandshakeTimer($state);
                $this->handshake($message->getPayload(), $connection, $ipAddress, $state);

                return;
            }

            if (! $state->client instanceof WebSshClient) {
                return;
            }

            if ($this->handleResizeFrame($message->getPayload(), $state->client)) {
                return;
            }

            $state->client->write($message->getPayload());
        });

        $connection->onClose(function () use ($ipAddress, $state): void {
            $this->cancelHandshakeTimer($state);

            if ($state->readTimer instanceof TimerInterface) {
                Loop::cancelTimer($state->readTimer);
                $state->readTimer = null;
            }

            if ($state->client instanceof WebSshClient) {
                $state->client->disconnect();
                $state->client = null;

                if ($state->token instanceof WsSessionToken) {
                    $this->audit($state->token, 'ssh.session.closed', $ipAddress);
                }
            }
        });

        $connection->openBuffer();

        return null;
    }

    private function handshake(string $payload, WebSocketConnection $connection, ?string $ipAddress, WebSshConnectionState $state): void
    {
        try {
            $result = $this->opener->open($payload, $ipAddress);
        } catch (WebSshError $error) {
            $this->sendError($connection, $error);
            $connection->close();

            return;
        } catch (Throwable) {
            $this->sendError($connection, WebSshError::make(WebSshError::SESSION_FAILED));
            $connection->close();

            return;
        }

        $state->token = $result->token;

        if (! $result->client instanceof WebSshClient) {
            $connection->close();

            return;
        }

        $state->client = $result->client;
        $connection->send($this->jsonFrame(['type' => 'ready']));
        $state->readTimer = $this->readPump($connection, $result->client);
    }

    private function readPump(WebSocketConnection $connection, WebSshClient $client): TimerInterface
    {
        return Loop::addPeriodicTimer(0.05, function () use ($connection, $client): void {
            try {
                $chunk = $client->read();
            } catch (Throwable) {
                $this->sendError($connection, new WebSshError('channel_closed', 'SSH channel closed.'));
                $connection->close();

                return;
            }

            if ($chunk !== '') {
                $connection->send(new Frame($chunk, opcode: Frame::OP_BINARY));
            }
        });
    }

    private function handleResizeFrame(string $payload, WebSshClient $client): bool
    {
        $decoded = json_decode($payload, associative: true);

        if (! is_array($decoded) || ($decoded['type'] ?? null) !== 'resize') {
            return false;
        }

        $cols = $decoded['cols'] ?? null;
        $rows = $decoded['rows'] ?? null;

        if (! is_int($cols) || ! is_int($rows) || $cols < 1 || $rows < 1 || $cols > 500 || $rows > 500) {
            return true;
        }

        $client->resize($cols, $rows);

        return true;
    }

    private function remoteAddress(WebSocketConnection $connection): ?string
    {
        try {
            $address = $connection->connection->__call('getRemoteAddress', []);
        } catch (Throwable) {
            return null;
        }

        return is_string($address) ? $address : null;
    }

    private function cancelHandshakeTimer(WebSshConnectionState $state): void
    {
        if ($state->handshakeTimer instanceof TimerInterface) {
            Loop::cancelTimer($state->handshakeTimer);
            $state->handshakeTimer = null;
        }
    }

    private function audit(WsSessionToken $token, string $action, ?string $ipAddress): void
    {
        AuditLog::query()->create([
            'actor_user_id' => $token->user_id,
            'action' => $action,
            'resource_type' => 'host',
            'resource_id' => $token->host_id,
            'metadata' => ['transport' => 'websocket'],
            'ip_address' => $ipAddress,
            'user_agent' => 'trominal-web-ssh-proxy',
        ]);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function jsonFrame(array $payload): string
    {
        return json_encode($payload, JSON_THROW_ON_ERROR);
    }

    private function sendError(WebSocketConnection $connection, WebSshError $error): void
    {
        $connection->send($this->jsonFrame($error->toFrame()));
    }
}
