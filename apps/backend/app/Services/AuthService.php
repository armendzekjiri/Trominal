<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AppSetting;
use App\Models\AuditLog;
use App\Models\Device;
use App\Models\PersonalAccessToken;
use App\Models\RefreshToken;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use PragmaRX\Google2FA\Google2FA;

final class AuthService
{
    /**
     * @param  array<string, mixed>  $payload
     * @return array{user: User, access_token: string, refresh_token: string, token_type: string, expires_in: int}
     */
    public function register(array $payload): array
    {
        /** @var array{user: User, access_token: string, refresh_token: string, token_type: string, expires_in: int} $tokenPair */
        $tokenPair = DB::transaction(function () use ($payload): array {
            /** @var AppSetting $setting */
            $setting = AppSetting::query()
                ->where('key', AppSetting::REGISTRATION)
                ->lockForUpdate()
                ->firstOrFail();

            $value = $setting->value;
            $mode = (string) ($value['mode'] ?? config('trominal.registration_mode', 'single'));
            $isOpen = (bool) ($value['open'] ?? false);
            $isFirstUser = User::query()->count() === 0;

            if (! $isOpen || $mode === 'closed' || ($mode === 'single' && ! $isFirstUser)) {
                throw new AuthorizationException(__('Registration is closed.'));
            }

            /** @var User $user */
            $user = User::query()->create([
                'name' => $payload['name'] ?? null,
                'email' => $payload['email'],
                'password' => $payload['password'],
                'kdf_salt' => $payload['kdf_salt'],
                'kdf_params' => $payload['kdf_params'],
                'public_key' => $payload['public_key'],
                'private_key_ciphertext' => $payload['private_key_ciphertext'],
                'private_key_nonce' => $payload['private_key_nonce'],
            ]);

            $user->assignRole($isFirstUser ? ['admin', 'user'] : ['user']);

            if ($mode === 'single') {
                $setting->update([
                    'value' => [
                        ...$value,
                        'open' => false,
                    ],
                ]);
            }

            AuditLog::record($user, 'auth.registered', 'user', (string) $user->id);

            return $this->issueTokenPair($user, (string) ($payload['device_name'] ?? 'Unknown device'));
        });

        return $tokenPair;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{user: User, access_token: string, refresh_token: string, token_type: string, expires_in: int}
     */
    public function login(array $payload): array
    {
        /** @var User|null $user */
        $user = User::query()->where('email', $payload['email'])->first();

        if (! $user instanceof User || ! Hash::check((string) $payload['password'], $user->password)) {
            AuditLog::record(null, 'auth.login.failed', 'user', null, [
                'email_hash' => hash('sha256', (string) $payload['email']),
            ]);

            throw ValidationException::withMessages([
                'email' => __('The provided credentials are incorrect.'),
            ]);
        }

        if ($user->suspended_at !== null) {
            AuditLog::record($user, 'auth.login.blocked_suspended', 'user', (string) $user->id);

            throw ValidationException::withMessages([
                'email' => __('This account is suspended.'),
            ]);
        }

        if ($user->two_fa_enabled_at !== null) {
            $code = (string) ($payload['two_factor_code'] ?? '');

            if (! $this->verifyTwoFactorCode($user, $code)) {
                AuditLog::record($user, 'auth.login.failed_2fa', 'user', (string) $user->id);

                throw ValidationException::withMessages([
                    'two_factor_code' => __('The two-factor authentication code is invalid.'),
                ]);
            }
        }

        AuditLog::record($user, 'auth.login.succeeded', 'user', (string) $user->id);

        return $this->issueTokenPair($user, (string) ($payload['device_name'] ?? 'Unknown device'));
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{user: User, access_token: string, refresh_token: string, token_type: string, expires_in: int}
     */
    public function refresh(array $payload): array
    {
        return DB::transaction(function () use ($payload): array {
            /** @var RefreshToken|null $refreshToken */
            $refreshToken = RefreshToken::query()
                ->where('token_hash', hash('sha256', (string) $payload['refresh_token']))
                ->lockForUpdate()
                ->first();

            if (! $refreshToken instanceof RefreshToken || ! $refreshToken->isUsable()) {
                throw ValidationException::withMessages([
                    'refresh_token' => __('The refresh token is invalid.'),
                ]);
            }

            /** @var User $user */
            $user = User::query()->findOrFail($refreshToken->user_id);

            if ($user->suspended_at !== null) {
                $refreshToken->update(['revoked_at' => now()]);

                throw ValidationException::withMessages([
                    'refresh_token' => __('The refresh token is invalid.'),
                ]);
            }

            $refreshToken->update(['rotated_at' => now()]);
            AuditLog::record($user, 'auth.token.refreshed', 'user', (string) $user->id);

            return $this->issueTokenPair($user, (string) ($payload['device_name'] ?? 'Unknown device'));
        });
    }

    public function logout(User $user, ?string $plainTextAccessToken = null): void
    {
        if ($plainTextAccessToken !== null) {
            PersonalAccessToken::findToken($plainTextAccessToken)?->delete();
        } else {
            $accessToken = $user->currentAccessToken();
            $accessToken->delete();
        }

        RefreshToken::query()
            ->where('user_id', $user->id)
            ->whereNull('revoked_at')
            ->update(['revoked_at' => now()]);

        AuditLog::record($user, 'auth.logout', 'user', (string) $user->id);
    }

    /**
     * @return array{secret: string, otpauth_uri: string}
     */
    public function enableTwoFactor(User $user): array
    {
        $google2fa = new Google2FA;
        $secret = $google2fa->generateSecretKey();

        $user->forceFill([
            'two_fa_secret_enc' => $secret,
            'two_fa_enabled_at' => null,
        ])->save();

        AuditLog::record($user, 'auth.2fa.enable_started', 'user', (string) $user->id);

        return [
            'secret' => $secret,
            'otpauth_uri' => $google2fa->getQRCodeUrl('Trominal', $user->email, $secret),
        ];
    }

    public function verifyTwoFactor(User $user, string $code): void
    {
        if (! $this->verifyTwoFactorCode($user, $code)) {
            throw ValidationException::withMessages([
                'code' => __('The two-factor authentication code is invalid.'),
            ]);
        }

        $user->forceFill(['two_fa_enabled_at' => now()])->save();
        AuditLog::record($user, 'auth.2fa.enabled', 'user', (string) $user->id);
    }

    public function disableTwoFactor(User $user, string $password, string $code): void
    {
        if (! Hash::check($password, $user->password)) {
            throw ValidationException::withMessages([
                'password' => __('The password is incorrect.'),
            ]);
        }

        if (! $this->verifyTwoFactorCode($user, $code)) {
            throw ValidationException::withMessages([
                'code' => __('The two-factor authentication code is invalid.'),
            ]);
        }

        $user->forceFill([
            'two_fa_secret_enc' => null,
            'two_fa_enabled_at' => null,
        ])->save();

        AuditLog::record($user, 'auth.2fa.disabled', 'user', (string) $user->id);
    }

    public function sendPasswordResetLink(string $email): void
    {
        Password::sendResetLink(['email' => $email]);

        AuditLog::record(null, 'auth.password_reset.requested', 'user', null, [
            'email_hash' => hash('sha256', $email),
        ]);
    }

    public function resetPassword(string $email, string $token, string $password): void
    {
        $status = Password::reset([
            'email' => $email,
            'token' => $token,
            'password' => $password,
            'password_confirmation' => $password,
        ], function (User $user, string $newPassword): void {
            $user->forceFill([
                'password' => Hash::make($newPassword),
                'remember_token' => Str::random(60),
            ])->save();

            $user->tokens()->delete();

            RefreshToken::query()
                ->where('user_id', $user->id)
                ->whereNull('revoked_at')
                ->update(['revoked_at' => now()]);

            event(new PasswordReset($user));
            AuditLog::record($user, 'auth.password.reset', 'user', (string) $user->id);
        });

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'email' => __($status),
            ]);
        }
    }

    /**
     * @return array{user: User, access_token: string, refresh_token: string, token_type: string, expires_in: int}
     */
    private function issueTokenPair(User $user, string $deviceName): array
    {
        /** @var Device $device */
        $device = Device::query()->create([
            'user_id' => $user->id,
            'name' => $deviceName,
            'last_used_at' => now(),
        ]);

        $accessMinutes = (int) config('trominal.access_token_expiration_minutes', 15);
        $refreshDays = (int) config('trominal.refresh_token_expiration_days', 30);
        $plainRefreshToken = bin2hex(random_bytes(64));

        RefreshToken::query()->create([
            'user_id' => $user->id,
            'device_id' => $device->id,
            'token_hash' => hash('sha256', $plainRefreshToken),
            'expires_at' => now()->addDays($refreshDays),
        ]);

        $accessToken = $user->createToken(
            name: $deviceName,
            abilities: ['*'],
            expiresAt: now()->addMinutes($accessMinutes),
        );

        return [
            'user' => $user->fresh(['roles', 'permissions']) ?? $user,
            'access_token' => $accessToken->plainTextToken,
            'refresh_token' => $plainRefreshToken,
            'token_type' => 'Bearer',
            'expires_in' => $accessMinutes * 60,
        ];
    }

    private function verifyTwoFactorCode(User $user, string $code): bool
    {
        if ($user->two_fa_secret_enc === null || $code === '') {
            return false;
        }

        return (bool) (new Google2FA)->verifyKey($user->two_fa_secret_enc, $code);
    }
}
