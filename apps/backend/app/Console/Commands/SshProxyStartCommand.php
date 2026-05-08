<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\Ssh\WebSshProxy;
use Illuminate\Console\Command;
use Laravel\Reverb\Servers\Reverb\Http\Route;
use Laravel\Reverb\Servers\Reverb\Http\Router;
use Laravel\Reverb\Servers\Reverb\Http\Server;
use React\EventLoop\Loop;
use React\Socket\SocketServer;
use Symfony\Component\Console\Command\SignalableCommandInterface;
use Symfony\Component\Routing\Matcher\UrlMatcher;
use Symfony\Component\Routing\RequestContext;
use Symfony\Component\Routing\RouteCollection;

final class SshProxyStartCommand extends Command implements SignalableCommandInterface
{
    /**
     * @var string
     */
    protected $signature = 'ssh-proxy:start
        {--host= : The IP address the SSH WebSocket proxy should bind to}
        {--port= : The port the SSH WebSocket proxy should listen on}
        {--path= : The WebSocket path that accepts SSH sessions}
        {--max-request-size=1048576 : Maximum HTTP upgrade request size in bytes}';

    /**
     * @var string
     */
    protected $description = 'Start the Trominal WebSocket SSH proxy.';

    private ?Server $server = null;

    public function handle(WebSshProxy $proxy): int
    {
        $host = (string) ($this->option('host') ?: config('trominal.web_ssh_proxy_host', '127.0.0.1'));
        $port = (string) ($this->option('port') ?: config('trominal.web_ssh_proxy_port', 8080));
        $path = $this->normalizedPath((string) ($this->option('path') ?: config('trominal.web_ssh_proxy_path', '/ws/ssh')));
        $maxRequestSize = max(1, (int) $this->option('max-request-size'));
        $loop = Loop::get();

        $routes = new RouteCollection;
        $routes->add('ssh_proxy', Route::get($path, $proxy));

        $this->server = new Server(
            new SocketServer($host.':'.$port, [], $loop),
            new Router(new UrlMatcher($routes, new RequestContext)),
            $maxRequestSize,
            $loop,
        );

        $this->components->info("Starting SSH WebSocket proxy on {$host}:{$port}{$path}");
        $this->server->start();

        return self::SUCCESS;
    }

    /**
     * @return list<int>
     */
    public function getSubscribedSignals(): array
    {
        if (windows_os()) {
            return [];
        }

        return [SIGINT, SIGTERM, SIGTSTP];
    }

    public function handleSignal(int $signal = 0, int|false $previousExitCode = 0): int|false
    {
        $this->components->info('Stopping SSH WebSocket proxy.');
        $this->server?->stop();

        return $previousExitCode;
    }

    private function normalizedPath(string $path): string
    {
        return '/'.ltrim($path, '/');
    }
}
