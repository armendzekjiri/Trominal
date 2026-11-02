<?php

declare(strict_types=1);

namespace App\Services\Ssh;

use RuntimeException;

/**
 * A web SSH failure with a stable machine-readable code that is sent to the
 * client in an error frame. Messages and details never contain credentials.
 */
final class WebSshError extends RuntimeException
{
    public const INVALID_FRAME = 'invalid_frame';

    public const INVALID_TOKEN = 'invalid_token';

    public const WEB_SSH_DISABLED = 'web_ssh_disabled';

    public const DESTINATION_MISMATCH = 'destination_mismatch';

    public const DESTINATION_UNRESOLVABLE = 'destination_unresolvable';

    public const DESTINATION_DENIED = 'destination_denied';

    public const CONNECT_FAILED = 'connect_failed';

    public const HOST_KEY_UNKNOWN = 'host_key_unknown';

    public const HOST_KEY_MISMATCH = 'host_key_mismatch';

    public const HOST_KEY_UNAVAILABLE = 'host_key_unavailable';

    public const AUTH_FAILED = 'auth_failed';

    public const SESSION_FAILED = 'session_failed';

    /**
     * Safe destination metadata recorded with the denial in the audit log.
     *
     * @var array<string, mixed>
     */
    public array $auditContext = [];

    /**
     * @param  array<string, string>  $details  Public, non-secret details (e.g. presented fingerprint).
     */
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly array $details = [],
    ) {
        parent::__construct($message);
    }

    /**
     * @param  array<string, string>  $details
     */
    public static function make(string $code, array $details = []): self
    {
        return new self($code, self::defaultMessage($code), $details);
    }

    /**
     * @param  array<string, mixed>  $context
     */
    public function withAuditContext(array $context): self
    {
        $this->auditContext = [...$this->auditContext, ...$context];

        return $this;
    }

    /**
     * @return array<string, string>
     */
    public function toFrame(): array
    {
        return [
            ...$this->details,
            'type' => 'error',
            'code' => $this->errorCode,
            'message' => $this->getMessage(),
        ];
    }

    private static function defaultMessage(string $code): string
    {
        return match ($code) {
            self::INVALID_FRAME => 'The SSH connect frame is invalid.',
            self::INVALID_TOKEN => 'The SSH session token is invalid or expired.',
            self::WEB_SSH_DISABLED => 'Web SSH is disabled for this instance.',
            self::DESTINATION_MISMATCH => 'The SSH destination does not match the session token.',
            self::DESTINATION_UNRESOLVABLE => 'The SSH host could not be resolved.',
            self::DESTINATION_DENIED => 'The SSH destination is not allowed from this server.',
            self::CONNECT_FAILED => 'Unable to connect to the SSH server.',
            self::HOST_KEY_UNKNOWN => 'No pinned host key was provided. Verify the host key fingerprint first.',
            self::HOST_KEY_MISMATCH => 'The SSH host key does not match the pinned fingerprint.',
            self::HOST_KEY_UNAVAILABLE => 'The SSH server did not present a verifiable host key.',
            self::AUTH_FAILED => 'SSH authentication failed.',
            default => 'Unable to open SSH session.',
        };
    }
}
