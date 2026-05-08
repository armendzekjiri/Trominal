<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\AuditLog;
use App\Models\Host;
use App\Models\User;
use App\Models\WsSessionToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

final class SshTokenController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $settings = AppSetting::registration()->value;

        if (! (bool) ($settings['web_ssh_enabled'] ?? true)) {
            abort(403, 'Web SSH is disabled for this instance.');
        }

        /** @var array{host_id: string} $payload */
        $payload = validator($request->all(), [
            'host_id' => ['required', 'string'],
        ])->validate();

        /** @var Host|null $host */
        $host = Host::query()
            ->whereKey($payload['host_id'])
            ->where('user_id', $user->id)
            ->first();

        if (! $host instanceof Host) {
            throw ValidationException::withMessages([
                'host_id' => __('The selected host is invalid.'),
            ]);
        }

        $plainToken = bin2hex(random_bytes(32));
        $expiresAt = now()->addSeconds(30);

        WsSessionToken::query()->create([
            'user_id' => $user->id,
            'host_id' => $host->id,
            'token_hash' => hash('sha256', $plainToken),
            'ip_address' => $request->ip(),
            'expires_at' => $expiresAt,
        ]);

        AuditLog::record($user, 'ssh.token.created', 'host', (string) $host->id, [
            'expires_at' => $expiresAt->toIso8601String(),
        ]);

        return response()->json([
            'token' => $plainToken,
            'expires_at' => $expiresAt->toIso8601String(),
            'websocket_url' => $this->websocketUrl($request, $plainToken),
        ], 201);
    }

    private function websocketUrl(Request $request, string $plainToken): string
    {
        $configuredUrl = config('trominal.web_ssh_proxy_url');

        if (is_string($configuredUrl) && $configuredUrl !== '') {
            return $this->appendToken($configuredUrl, $plainToken);
        }

        $scheme = $request->isSecure() ? 'wss' : 'ws';
        $path = config('trominal.web_ssh_proxy_path', '/ws/ssh');
        $normalizedPath = '/'.ltrim(is_string($path) ? $path : '/ws/ssh', '/');

        return $this->appendToken($scheme.'://'.$request->getHttpHost().$normalizedPath, $plainToken);
    }

    private function appendToken(string $url, string $plainToken): string
    {
        $separator = str_contains($url, '?') ? '&' : '?';

        return $url.$separator.'token='.rawurlencode($plainToken);
    }
}
