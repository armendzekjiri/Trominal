<?php

declare(strict_types=1);

namespace App\Services\Ssh\Client;

interface WebSshConnector
{
    /**
     * Open a TCP connection to exactly this (already vetted) IP address and
     * wrap it in an SSH client. No name resolution happens here.
     *
     * @throws \RuntimeException when the connection cannot be established.
     */
    public function connect(string $ipAddress, int $port): WebSshClient;
}
