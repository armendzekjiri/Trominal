<?php

declare(strict_types=1);

namespace App\Services\Ssh;

use App\Models\AppSetting;
use App\Models\AuditLog;
use App\Models\WsSessionToken;
use App\Services\Ssh\Client\WebSshClient;
use App\Services\Ssh\Client\WebSshConnector;
use App\Services\Ssh\Egress\EgressDecision;
use App\Services\Ssh\Egress\HostResolver;
use App\Services\Ssh\Egress\WebSshEgressPolicy;
use App\Support\Network\IpAddress;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use Throwable;

/**
 * Turns the first WebSocket frame of a web SSH connection into an SSH
 * session (or a host key probe), enforcing in order: a valid single-use
 * token bound to the client address, a pinned host key fingerprint, the
 * destination bound to that token, the egress policy on the resolved
 * address, the connected peer, and the presented host key. All of this
 * happens before any credential is sent.
 */
final class WebSshSessionOpener
{
    public function __construct(
        private readonly SshTokenVerifier $tokens,
        private readonly HostResolver $resolver,
        private readonly WebSshConnector $connector,
        private readonly WebSshEgressPolicy $egress,
    ) {
        //
    }

    /**
     * @throws WebSshError
     */
    public function open(string $payload, ?string $clientIp): WebSshOpenResult
    {
        $decoded = json_decode($payload, associative: true);

        if (! is_array($decoded)) {
            throw WebSshError::make(WebSshError::INVALID_FRAME);
        }

        $plainToken = $decoded['token'] ?? null;

        if (! is_string($plainToken)) {
            throw WebSshError::make(WebSshError::INVALID_TOKEN);
        }

        if (! $this->webSshEnabled()) {
            throw WebSshError::make(WebSshError::WEB_SSH_DISABLED);
        }

        try {
            $token = $this->tokens->consume($plainToken, $clientIp);
        } catch (ValidationException) {
            throw WebSshError::make(WebSshError::INVALID_TOKEN);
        }

        $type = $decoded['type'] ?? null;
        $frame = null;

        try {
            try {
                /** @var array<string, mixed> $decoded */
                $frame = match ($type) {
                    'probe' => WebSshProbeFrame::fromArray($decoded),
                    'connect' => WebSshConnectFrame::fromArray($decoded),
                    default => throw WebSshError::make(WebSshError::INVALID_FRAME),
                };
            } catch (ValidationException) {
                throw WebSshError::make(WebSshError::INVALID_FRAME);
            } finally {
                unset($decoded);
            }

            return $frame instanceof WebSshProbeFrame
                ? $this->probe($token, $frame, $clientIp)
                : $this->openSession($token, $frame, $clientIp);
        } catch (WebSshError $error) {
            $this->audit($token, 'ssh.session.denied', $clientIp, [
                'transport' => 'websocket',
                'mode' => $type === 'probe' ? 'probe' : 'connect',
                'reason' => $error->errorCode,
                ...($frame !== null ? ['port' => $frame->port] : []),
                ...$error->auditContext,
            ]);

            throw $error;
        } finally {
            if ($frame instanceof WebSshConnectFrame) {
                $frame->wipeSecrets();
            }
        }
    }

    /**
     * First-use flow: report the presented host key so the user can verify
     * and pin it. No credentials are involved.
     */
    private function probe(WsSessionToken $token, WebSshProbeFrame $frame, ?string $clientIp): WebSshOpenResult
    {
        $destination = $this->boundDestination($token, $frame->hostId, $frame->host, $frame->port);
        $decision = $this->vettedAddress($destination);
        $client = $this->connectTo($decision, $destination->port);

        try {
            $hostKey = $this->presentedHostKey($client, $decision);
        } finally {
            $client->disconnect();
        }

        $this->audit($token, 'ssh.host_key.probed', $clientIp, [
            'transport' => 'websocket',
            'port' => $destination->port,
            ...$decision->auditMetadata(),
            'host_key_type' => $hostKey->keyType,
            'host_key_fingerprint' => $hostKey->fingerprint,
        ]);

        return WebSshOpenResult::probe($token, $hostKey->fingerprint, $hostKey->keyType);
    }

    private function openSession(WsSessionToken $token, WebSshConnectFrame $frame, ?string $clientIp): WebSshOpenResult
    {
        // A pin is mandatory. Reject before any network access so a missing
        // pin can never fall through to trust-on-first-use.
        if ($frame->hostKeyFingerprint === null || $frame->hostKeyFingerprint === '') {
            throw WebSshError::make(WebSshError::HOST_KEY_UNKNOWN);
        }

        if (! HostKeyFingerprint::isWellFormed($frame->hostKeyFingerprint)) {
            throw WebSshError::make(WebSshError::INVALID_FRAME);
        }

        $destination = $this->boundDestination($token, $frame->hostId, $frame->host, $frame->port);
        $decision = $this->vettedAddress($destination);
        $client = $this->connectTo($decision, $destination->port);

        try {
            // Verify the server's host key against the pin BEFORE sending any
            // credential. phpseclib also checks that the key exchange was
            // signed by this key.
            $hostKey = $this->presentedHostKey($client, $decision);

            if (! $hostKey->matches($frame->hostKeyFingerprint)) {
                throw WebSshError::make(WebSshError::HOST_KEY_MISMATCH, [
                    'fingerprint' => $hostKey->fingerprint,
                    'key_type' => $hostKey->keyType,
                ])->withAuditContext([
                    ...$decision->auditMetadata(),
                    'host_key_type' => $hostKey->keyType,
                    'host_key_fingerprint' => $hostKey->fingerprint,
                ]);
            }

            if (! $this->authenticate($client, $frame)) {
                throw WebSshError::make(WebSshError::AUTH_FAILED)->withAuditContext($decision->auditMetadata());
            }

            $client->openShell($frame->cols, $frame->rows);
        } catch (WebSshError $error) {
            $client->disconnect();

            throw $error;
        } catch (Throwable) {
            $client->disconnect();

            throw WebSshError::make(WebSshError::SESSION_FAILED)->withAuditContext($decision->auditMetadata());
        }

        $this->audit($token, 'ssh.session.opened', $clientIp, [
            'transport' => 'websocket',
            'port' => $destination->port,
            ...$decision->auditMetadata(),
            'host_key_type' => $hostKey->keyType,
            'host_key_fingerprint' => $hostKey->fingerprint,
            'cols' => $frame->cols,
            'rows' => $frame->rows,
        ]);

        return WebSshOpenResult::session($token, $client, $hostKey->fingerprint, $hostKey->keyType);
    }

    private function presentedHostKey(WebSshClient $client, EgressDecision $decision): HostKeyFingerprint
    {
        try {
            $blob = $client->serverHostKey();

            if ($blob === null) {
                throw new InvalidArgumentException('No host key.');
            }

            return HostKeyFingerprint::fromBlob($blob);
        } catch (Throwable) {
            throw WebSshError::make(WebSshError::HOST_KEY_UNAVAILABLE)->withAuditContext($decision->auditMetadata());
        }
    }

    private function boundDestination(WsSessionToken $token, string $hostId, string $host, int $port): WebSshDestination
    {
        try {
            $destination = WebSshDestination::from($host, $port);
        } catch (InvalidArgumentException) {
            throw WebSshError::make(WebSshError::INVALID_FRAME);
        }

        if (
            $token->host_id === null
            || ! hash_equals($token->host_id, $hostId)
            || ! $destination->matches($token->destination_hash, WebSshDestination::appKey())
        ) {
            throw WebSshError::make(WebSshError::DESTINATION_MISMATCH);
        }

        return $destination;
    }

    /**
     * Resolve the destination once and pick an address the egress policy
     * allows. The connection is then made to that exact address, so a later
     * DNS change cannot redirect it.
     */
    private function vettedAddress(WebSshDestination $destination): EgressDecision
    {
        $addresses = $this->resolver->resolve($destination->host);

        if ($addresses === []) {
            throw WebSshError::make(WebSshError::DESTINATION_UNRESOLVABLE);
        }

        $decisions = array_map($this->egress->evaluate(...), $addresses);

        foreach ($decisions as $decision) {
            if ($decision->allowed) {
                return $decision;
            }
        }

        throw WebSshError::make(WebSshError::DESTINATION_DENIED)
            ->withAuditContext($decisions[0]->auditMetadata());
    }

    private function connectTo(EgressDecision $decision, int $port): WebSshClient
    {
        if ($decision->address === null) {
            throw WebSshError::make(WebSshError::DESTINATION_DENIED);
        }

        try {
            $client = $this->connector->connect($decision->address, $port);
        } catch (Throwable) {
            throw WebSshError::make(WebSshError::CONNECT_FAILED)->withAuditContext($decision->auditMetadata());
        }

        // Re-check the address actually connected to before any SSH traffic.
        $peer = $client->peerAddress();

        if (! IpAddress::equals($peer, $decision->address) || ! $this->egress->evaluate((string) $peer)->allowed) {
            $client->disconnect();

            throw WebSshError::make(WebSshError::DESTINATION_DENIED)->withAuditContext($decision->auditMetadata());
        }

        return $client;
    }

    private function authenticate(WebSshClient $client, WebSshConnectFrame $frame): bool
    {
        if ($frame->authKind === 'password' && $frame->password !== null) {
            return $client->loginWithPassword($frame->username, $frame->password);
        }

        if ($frame->authKind === 'private-key' && $frame->privateKeyPemB64 !== null) {
            $privateKeyPem = base64_decode($frame->privateKeyPemB64, strict: true);

            if (! is_string($privateKeyPem)) {
                return false;
            }

            try {
                return $client->loginWithPrivateKey($frame->username, $privateKeyPem, $frame->passphrase ?? '');
            } finally {
                if (function_exists('sodium_memzero')) {
                    sodium_memzero($privateKeyPem);
                }
            }
        }

        return $client->loginWithoutCredentials($frame->username);
    }

    private function webSshEnabled(): bool
    {
        $settings = AppSetting::registration()->value;

        return (bool) ($settings['web_ssh_enabled'] ?? false);
    }

    /**
     * @param  array<string, mixed>  $metadata
     */
    private function audit(WsSessionToken $token, string $action, ?string $clientIp, array $metadata): void
    {
        AuditLog::query()->create([
            'actor_user_id' => $token->user_id,
            'action' => $action,
            'resource_type' => 'host',
            'resource_id' => $token->host_id,
            'metadata' => $metadata === [] ? null : $metadata,
            'ip_address' => $clientIp,
            'user_agent' => 'trominal-web-ssh-proxy',
        ]);
    }
}
