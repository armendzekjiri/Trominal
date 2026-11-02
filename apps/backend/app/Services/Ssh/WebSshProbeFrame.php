<?php

declare(strict_types=1);

namespace App\Services\Ssh;

use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * First-use host key probe: asks the proxy to run the SSH key exchange with
 * the bound destination and report the presented host key, without
 * authenticating. Any credentials included in the frame are ignored.
 */
final class WebSshProbeFrame
{
    private function __construct(
        public readonly string $hostId,
        public readonly string $host,
        public readonly int $port,
    ) {
        //
    }

    /**
     * @param  array<string, mixed>  $decoded
     *
     * @throws ValidationException
     */
    public static function fromArray(array $decoded): self
    {
        /** @var array{host_id: string, host: string, port: int} $validated */
        $validated = Validator::make($decoded, [
            'type' => ['required', 'in:probe'],
            'host_id' => ['required', 'string', 'max:64'],
            'host' => ['required', 'string', 'max:255'],
            'port' => ['required', 'integer', 'min:1', 'max:65535'],
        ])->validate();

        return new self($validated['host_id'], $validated['host'], $validated['port']);
    }
}
