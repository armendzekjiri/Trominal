<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\AuditLog;
use App\Models\Host;
use App\Models\User;
use App\Models\WsSessionToken;
use App\Services\Ssh\WebSshDestination;
use App\Support\Network\IpAddress;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class SshTokenController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $settings = AppSetting::registration()->value;

        if (! (bool) ($settings['web_ssh_enabled'] ?? false)) {
            abort(403, 'Web SSH is disabled for this instance.');
        }

        /** @var array{host_id: string, host: string, port: int} $payload */
        $payload = validator($request->all(), [
            'host_id' => ['required', 'string', 'max:64'],
            'host' => [
                'required',
                'string',
                'max:255',
                static function (string $attribute, mixed $value, Closure $fail): void {
                    if (! is_string($value) || ! WebSshDestination::isValid($value, 22)) {
                        $fail(__('The SSH host must be a hostname or IP address.'));
                    }
                },
            ],
            'port' => ['required', 'integer', 'between:1,65535'],
        ])->validate();

        /** @var Host|null $host */
        $host = Host::query()->whereKey($payload['host_id'])->first();

        // Hosts the caller cannot see (another user's personal host, or a
        // team they are not a member of) look like unknown hosts; visible
        // team hosts additionally require a team role that may connect.
        if (! $host instanceof Host || Gate::denies('view', $host)) {
            throw ValidationException::withMessages([
                'host_id' => __('The selected host is invalid.'),
            ]);
        }

        Gate::authorize('connect', $host);

        // Host addresses are end-to-end encrypted, so the client states the
        // destination here and the proxy only connects to that destination.
        $destination = WebSshDestination::from($payload['host'], (int) $payload['port']);

        $plainToken = bin2hex(random_bytes(32));
        $expiresAt = now()->addSeconds(30);

        WsSessionToken::query()->create([
            'user_id' => $user->id,
            'host_id' => $host->id,
            'token_hash' => hash('sha256', $plainToken),
            'destination_hash' => $destination->bindingHash(WebSshDestination::appKey()),
            'ip_address' => IpAddress::normalize($request->ip()),
            'expires_at' => $expiresAt,
        ]);

        AuditLog::record($user, 'ssh.token.created', 'host', (string) $host->id, [
            'expires_at' => $expiresAt->toIso8601String(),
            'port' => $destination->port,
        ]);

        return response()->json([
            'token' => $plainToken,
            'expires_at' => $expiresAt->toIso8601String(),
            // The token is sent inside the first WebSocket frame, never in the
            // URL, so it cannot end up in proxy or access logs.
            'websocket_url' => $this->websocketUrl($request),
        ], 201);
    }

    private function websocketUrl(Request $request): string
    {
        $configuredUrl = config('trominal.web_ssh_proxy_url');

        if (is_string($configuredUrl) && $configuredUrl !== '') {
            return $configuredUrl;
        }

        $scheme = $this->usesTls($request) ? 'wss' : 'ws';
        $path = config('trominal.web_ssh_proxy_path', '/ws/ssh');
        $normalizedPath = '/'.ltrim(is_string($path) ? $path : '/ws/ssh', '/');

        return $scheme.'://'.$request->getHttpHost().$normalizedPath;
    }

    /**
     * Web SSH carries terminal traffic and a session token, so production
     * always hands out wss:// — even when TLS ends at an upstream proxy that
     * Laravel is not configured to trust. Plain ws:// is left for loopback,
     * *.localhost and *.test development hosts.
     */
    private function usesTls(Request $request): bool
    {
        if ($request->isSecure()) {
            return true;
        }

        return app()->isProduction() && ! $this->isDevelopmentHost($request->getHost());
    }

    private function isDevelopmentHost(string $host): bool
    {
        $host = strtolower(rtrim($host, '.'));

        return $host === 'localhost'
            || str_ends_with($host, '.localhost')
            || str_ends_with($host, '.test')
            || $host === '[::1]'
            || $host === '::1'
            || preg_match('/^127(?:\.\d{1,3}){3}$/', $host) === 1;
    }
}
