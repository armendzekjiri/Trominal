<?php

declare(strict_types=1);

namespace App\Services\Ssh;

use App\Models\AuditLog;
use App\Models\WsSessionToken;
use Illuminate\Validation\ValidationException;
use Laravel\Reverb\Servers\Reverb\Connection as WebSocketConnection;
use Laravel\Reverb\Servers\Reverb\Http\Response;
use phpseclib3\Crypt\PublicKeyLoader;
use phpseclib3\Net\SSH2;
use Psr\Http\Message\RequestInterface;
use Ratchet\RFC6455\Messaging\DataInterface;
use Ratchet\RFC6455\Messaging\Frame;
use React\EventLoop\Loop;
use React\EventLoop\TimerInterface;
use Throwable;

final class WebSshProxy
{
    public function __construct(private readonly SshTokenVerifier $tokens)
    {
        //
    }

    public function __invoke(RequestInterface $request, mixed $connection): ?Response
    {
        if (! $connection instanceof WebSocketConnection) {
            return new Response([
                'message' => 'WebSocket upgrade required.',
            ], 426);
        }

        $ipAddress = $this->ipAddress($request);

        try {
            $token = $this->tokens->consume($this->plainToken($request), $ipAddress);
        } catch (ValidationException) {
            $this->sendError($connection, 'The SSH session token is invalid or expired.');
            $connection->close();

            return null;
        }

        $connection->withMaxMessageSize(1024 * 1024);

        /** @var SSH2|null $ssh */
        $ssh = null;
        /** @var TimerInterface|null $readTimer */
        $readTimer = null;

        $connection->onMessage(function (DataInterface $message) use ($connection, $token, $ipAddress, &$ssh, &$readTimer): void {
            if (! $ssh instanceof SSH2) {
                $this->openSshSession($message->getPayload(), $connection, $token, $ipAddress, $ssh, $readTimer);

                return;
            }

            if ($this->handleResizeFrame($message->getPayload(), $ssh)) {
                return;
            }

            $ssh->write($message->getPayload());
        });

        $connection->onClose(function () use ($token, $ipAddress, &$ssh, &$readTimer): void {
            if ($readTimer instanceof TimerInterface) {
                Loop::cancelTimer($readTimer);
                $readTimer = null;
            }

            if ($ssh instanceof SSH2) {
                $ssh->disconnect();
                $ssh = null;
            }

            $this->audit($token, 'ssh.session.closed', $ipAddress);
        });

        $connection->openBuffer();

        return null;
    }

    private function openSshSession(
        string $payload,
        WebSocketConnection $connection,
        WsSessionToken $token,
        ?string $ipAddress,
        ?SSH2 &$ssh,
        ?TimerInterface &$readTimer,
    ): void {
        try {
            $frame = WebSshConnectFrame::fromJson($payload);

            if ($token->host_id !== null && $frame->hostId !== null && $token->host_id !== $frame->hostId) {
                throw ValidationException::withMessages([
                    'host_id' => __('The SSH connect frame does not match the session token.'),
                ]);
            }

            $ssh = new SSH2($frame->host, $frame->port, 10);
            $ssh->setWindowSize($frame->cols, $frame->rows);

            if (! $this->authenticate($ssh, $frame)) {
                $frame->wipeSecrets();
                $this->sendError($connection, 'SSH authentication failed.');
                $connection->close();

                return;
            }

            $frame->wipeSecrets();
            $ssh->setTimeout(0.05);
            $ssh->openShell();
            $readTimer = $this->readPump($connection, $ssh);

            $this->audit($token, 'ssh.session.opened', $ipAddress, [
                'transport' => 'websocket',
                'cols' => $frame->cols,
                'rows' => $frame->rows,
            ]);
        } catch (Throwable) {
            $this->sendError($connection, 'Unable to open SSH session.');
            $connection->close();
        }
    }

    private function authenticate(SSH2 $ssh, WebSshConnectFrame $frame): bool
    {
        try {
            if ($frame->authKind === 'password' && $frame->password !== null) {
                return $ssh->login($frame->username, $frame->password);
            }

            if ($frame->authKind === 'private-key' && $frame->privateKeyPemB64 !== null) {
                $privateKeyPem = base64_decode($frame->privateKeyPemB64, strict: true);

                if (! is_string($privateKeyPem)) {
                    return false;
                }

                try {
                    $key = PublicKeyLoader::loadPrivateKey($privateKeyPem, $frame->passphrase ?? '');

                    return $ssh->login($frame->username, $key);
                } finally {
                    $this->wipeString($privateKeyPem);
                }
            }

            return $ssh->login($frame->username);
        } finally {
            $frame->wipeSecrets();
        }
    }

    private function readPump(WebSocketConnection $connection, SSH2 $ssh): TimerInterface
    {
        return Loop::addPeriodicTimer(0.05, function () use ($connection, $ssh): void {
            try {
                $chunk = $ssh->read('', SSH2::READ_NEXT);
            } catch (Throwable) {
                $this->sendError($connection, 'SSH channel closed.');
                $connection->close();

                return;
            }

            if (is_string($chunk) && $chunk !== '') {
                $connection->send(new Frame($chunk, opcode: Frame::OP_BINARY));
            }
        });
    }

    private function handleResizeFrame(string $payload, SSH2 $ssh): bool
    {
        $decoded = json_decode($payload, associative: true);

        if (! is_array($decoded) || ($decoded['type'] ?? null) !== 'resize') {
            return false;
        }

        $cols = $decoded['cols'] ?? null;
        $rows = $decoded['rows'] ?? null;

        if (! is_int($cols) || ! is_int($rows) || $cols < 1 || $rows < 1) {
            return true;
        }

        $ssh->setWindowSize($cols, $rows);

        return true;
    }

    private function plainToken(RequestInterface $request): string
    {
        parse_str($request->getUri()->getQuery(), $query);
        $token = $query['token'] ?? null;

        return is_string($token) ? $token : '';
    }

    private function ipAddress(RequestInterface $request): ?string
    {
        $forwardedFor = $request->getHeaderLine('X-Forwarded-For');

        if ($forwardedFor !== '') {
            $parts = explode(',', $forwardedFor);

            return trim($parts[0]);
        }

        $realIp = $request->getHeaderLine('X-Real-IP');

        return $realIp !== '' ? $realIp : null;
    }

    /**
     * @param  array<string, mixed>  $metadata
     */
    private function audit(WsSessionToken $token, string $action, ?string $ipAddress, array $metadata = []): void
    {
        AuditLog::query()->create([
            'actor_user_id' => $token->user_id,
            'action' => $action,
            'resource_type' => 'host',
            'resource_id' => $token->host_id,
            'metadata' => $metadata === [] ? null : $metadata,
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

    private function sendError(WebSocketConnection $connection, string $message): void
    {
        $connection->send($this->jsonFrame([
            'type' => 'error',
            'message' => $message,
        ]));
    }

    private function wipeString(string $value): void
    {
        if (function_exists('sodium_memzero')) {
            sodium_memzero($value);
        }
    }
}
