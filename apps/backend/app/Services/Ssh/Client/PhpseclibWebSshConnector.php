<?php

declare(strict_types=1);

namespace App\Services\Ssh\Client;

use App\Support\Network\IpAddress;
use phpseclib3\Net\SSH2;
use RuntimeException;

final class PhpseclibWebSshConnector implements WebSshConnector
{
    private const CONNECT_TIMEOUT_SECONDS = 10;

    public function connect(string $ipAddress, int $port): WebSshClient
    {
        $address = IpAddress::normalize($ipAddress);

        if ($address === null) {
            throw new RuntimeException('Refusing to connect to a non-literal address.');
        }

        $target = str_contains($address, ':') ? "tcp://[{$address}]:{$port}" : "tcp://{$address}:{$port}";

        // Connect the socket ourselves so phpseclib never resolves a name and
        // the peer of the established connection can be checked afterwards.
        $socket = @stream_socket_client($target, $errno, $errstr, self::CONNECT_TIMEOUT_SECONDS);

        if (! is_resource($socket)) {
            throw new RuntimeException('Unable to connect to the SSH server.');
        }

        $peer = stream_socket_get_name($socket, true);

        return new PhpseclibWebSshClient(
            new SSH2($socket, $port, self::CONNECT_TIMEOUT_SECONDS),
            is_string($peer) ? self::addressFromSocketName($peer) : null,
        );
    }

    private static function addressFromSocketName(string $name): ?string
    {
        if (preg_match('/^\[([^\]]+)\]:\d+$/', $name, $matches) === 1) {
            return IpAddress::normalize($matches[1]);
        }

        $separator = strrpos($name, ':');

        if ($separator === false) {
            return IpAddress::normalize($name);
        }

        return IpAddress::normalize(substr($name, 0, $separator));
    }
}
