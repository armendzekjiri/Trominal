<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AppSetting;
use App\Models\AuditLog;
use App\Models\Device;
use App\Models\Invite;
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
    public function __construct(private readonly TwoFactorCodeVerifier $codes) {}

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

            $invite = $mode === 'invite'
                ? $this->consumeInviteForRegistration($payload)
                : null;

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

            AuditLog::record(
                actor: $user,
                action: 'auth.registered',
                resourceType: 'user',
                resourceId: (string) $user->id,
                metadata: $invite instanceof Invite ? ['invite_id' => $invite->id] : [],
            );

            return $this->issueTokenPair($user, (string) ($payload['device_name'] ?? 'Unknown device'));
        });

        return $tokenPair;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function consumeInviteForRegistration(array $payload): Invite
    {
        $inviteCode = (string) ($payload['invite_code'] ?? '');

        if ($inviteCode === '') {
            throw new AuthorizationException(__('An invite code is required.'));
        }

        /** @var Invite|null $invite */
        $invite = Invite::query()
            ->where('code_hash', hash('sha256', $inviteCode))
            ->lockForUpdate()
            ->first();

        if (! $invite instanceof Invite) {
            throw new AuthorizationException(__('The invite code is invalid.'));
        }

        $email = strtolower((string) $payload['email']);
        $inviteEmail = strtolower((string) ($invite->email ?? ''));

        if (
            $invite->used_at !== null
            || ($invite->expires_at !== null && $invite->expires_at->isPast())
            || ($inviteEmail !== '' && $inviteEmail !== $email)
        ) {
            throw new AuthorizationException(__('The invite code is invalid.'));
        }

        $invite->forceFill(['used_at' => now()])->save();

        return $invite;
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
        $tokenHash = hash('sha256', (string) $payload['refresh_token']);

        // The transaction only decides the outcome; the error is thrown after
        // it commits so that a family revocation is never rolled back.
        /** @var array{user: User, access_token: string, refresh_token: string, token_type: string, expires_in: int}|null $pair */
        $pair = DB::transaction(function () use ($tokenHash, $payload): ?array {
            /** @var RefreshToken|null $refreshToken */
            $refreshToken = RefreshToken::query()
                ->where('token_hash', $tokenHash)
                ->lockForUpdate()
                ->first();

            if (! $refreshToken instanceof RefreshToken) {
                return null;
            }

            if ($refreshToken->rotated_at !== null) {
                // A token that was already exchanged is being presented again:
                // the legitimate client or an attacker holds a copy, and we
                // cannot tell which. Revoke everything descended from it.
                $this->revokeRefreshTokenFamily($refreshToken);

                return null;
            }

            if (! $refreshToken->isUsable()) {
                return null;
            }

            /** @var User|null $user */
            $user = User::query()->find($refreshToken->user_id);

            if (! $user instanceof User || $user->suspended_at !== null) {
                $refreshToken->update(['revoked_at' => now()]);

                return null;
            }

            // Claim the token with a conditional update so two concurrent
            // refreshes can never both rotate it, even without row locks.
            $claimed = RefreshToken::query()
                ->whereKey($refreshToken->getKey())
                ->whereNull('rotated_at')
                ->whereNull('revoked_at')
                ->update(['rotated_at' => now()]);

            if ($claimed !== 1) {
                $this->revokeRefreshTokenFamily($refreshToken);

                return null;
            }

            AuditLog::record($user, 'auth.token.refreshed', 'user', (string) $user->id, [
                'device_id' => $refreshToken->device_id,
            ]);

            return $this->issueTokenPair(
                $user,
                (string) ($payload['device_name'] ?? 'Unknown device'),
                $refreshToken->device_id,
                $refreshToken->family_id ?? (string) $refreshToken->getKey(),
            );
        });

        if ($pair === null) {
            throw ValidationException::withMessages([
                'refresh_token' => __('The refresh token is invalid.'),
            ]);
        }

        return $pair;
    }

    /**
     * Revoke every refresh token in the presented token's family and every
     * access token issued to its device, then record the incident.
     */
    private function revokeRefreshTokenFamily(RefreshToken $refreshToken): void
    {
        $familyId = $refreshToken->family_id ?? (string) $refreshToken->getKey();

        $refreshTokensRevoked = RefreshToken::query()
            ->where('user_id', $refreshToken->user_id)
            ->where(function ($query) use ($familyId): void {
                $query->where('family_id', $familyId)->orWhere('id', $familyId);
            })
            ->whereNull('revoked_at')
            ->update(['revoked_at' => now()]);

        $accessTokensRevoked = $refreshToken->device_id === null
            ? 0
            : PersonalAccessToken::query()
                ->where('tokenable_type', (new User)->getMorphClass())
                ->where('tokenable_id', $refreshToken->user_id)
                ->where('device_id', $refreshToken->device_id)
                ->delete();

        /** @var User|null $user */
        $user = User::query()->find($refreshToken->user_id);

        AuditLog::record($user, 'auth.token.reuse_detected', 'user', $refreshToken->user_id, [
            'family_id' => $familyId,
            'device_id' => $refreshToken->device_id,
            'refresh_tokens_revoked' => $refreshTokensRevoked,
            'access_tokens_revoked' => $accessTokensRevoked,
        ]);
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
    /**
     * Stage a new TOTP secret. The active factor is never modified here; it
     * is only replaced once the pending secret is confirmed in verify.
     *
     * Replacing an already-enabled factor requires the login password and a
     * valid code from the current authenticator.
     *
     * @return array{secret: string, otpauth_uri: string}
     */
    public function enableTwoFactor(User $user, ?string $password = null, ?string $code = null): array
    {
        $replacing = $user->two_fa_enabled_at !== null;

        if ($replacing) {
            $this->assertTwoFactorStepUp($user, $password, $code, 'auth.2fa.replace_denied');
        }

        $google2fa = new Google2FA;
        $secret = $google2fa->generateSecretKey();

        $user->forceFill(['two_fa_pending_secret_enc' => $secret])->save();

        AuditLog::record(
            $user,
            $replacing ? 'auth.2fa.replace_started' : 'auth.2fa.enable_started',
            'user',
            (string) $user->id,
        );

        return [
            'secret' => $secret,
            'otpauth_uri' => $google2fa->getQRCodeUrl('Trominal', $user->email, $secret),
        ];
    }

    /**
     * Confirm the pending secret and promote it to the active factor. When it
     * replaces an existing factor, every other session is revoked.
     */
    public function verifyTwoFactor(User $user, string $code): void
    {
        $pendingSecret = $user->two_fa_pending_secret_enc;

        if ($pendingSecret === null) {
            throw ValidationException::withMessages([
                'code' => __('There is no pending two-factor setup to confirm.'),
            ]);
        }

        if ($this->codes->match($pendingSecret, $code) === null) {
            AuditLog::record($user, 'auth.2fa.verify_failed', 'user', (string) $user->id);

            throw ValidationException::withMessages([
                'code' => __('The two-factor authentication code is invalid.'),
            ]);
        }

        $replacing = $user->two_fa_enabled_at !== null;

        DB::transaction(function () use ($user, $pendingSecret, $replacing): void {
            $user->forceFill([
                'two_fa_secret_enc' => $pendingSecret,
                'two_fa_pending_secret_enc' => null,
                'two_fa_enabled_at' => now(),
            ])->save();

            if (! $replacing) {
                AuditLog::record($user, 'auth.2fa.enabled', 'user', (string) $user->id);

                return;
            }

            AuditLog::record($user, 'auth.2fa.replaced', 'user', (string) $user->id, [
                ...$this->revokeOtherSessions($user),
            ]);
        });
    }

    public function disableTwoFactor(User $user, string $password, string $code): void
    {
        $this->assertTwoFactorStepUp($user, $password, $code, 'auth.2fa.disable_denied');

        $user->forceFill([
            'two_fa_secret_enc' => null,
            'two_fa_pending_secret_enc' => null,
            'two_fa_enabled_at' => null,
        ])->save();

        AuditLog::record($user, 'auth.2fa.disabled', 'user', (string) $user->id);
    }

    /**
     * Require the login password and a valid code from the active factor.
     */
    private function assertTwoFactorStepUp(User $user, ?string $password, ?string $code, string $deniedAction): void
    {
        $missing = [];

        if ($password === null || $password === '') {
            $missing['password'] = __('Confirm your password to change two-factor authentication.');
        }

        if ($code === null || $code === '') {
            $missing['code'] = __('Enter a code from your current authenticator app.');
        }

        if ($missing !== []) {
            AuditLog::record($user, $deniedAction, 'user', (string) $user->id, ['reason' => 'missing_step_up']);

            throw ValidationException::withMessages($missing);
        }

        if (! Hash::check((string) $password, $user->password)) {
            AuditLog::record($user, $deniedAction, 'user', (string) $user->id, ['reason' => 'password']);

            throw ValidationException::withMessages([
                'password' => __('The password is incorrect.'),
            ]);
        }

        if (! $this->verifyTwoFactorCode($user, (string) $code)) {
            AuditLog::record($user, $deniedAction, 'user', (string) $user->id, ['reason' => 'code']);

            throw ValidationException::withMessages([
                'code' => __('The two-factor authentication code is invalid.'),
            ]);
        }
    }

    /**
     * Revoke every access and refresh token of the user except the ones that
     * belong to the device making the current request.
     *
     * @return array{access_tokens_revoked: int, refresh_tokens_revoked: int}
     */
    private function revokeOtherSessions(User $user): array
    {
        $current = $user->currentAccessToken();
        $currentTokenId = $current instanceof PersonalAccessToken ? $current->getKey() : null;
        $currentDeviceId = $current instanceof PersonalAccessToken ? $current->getAttribute('device_id') : null;

        $accessTokensRevoked = $user->tokens()
            ->when($currentTokenId !== null, fn ($query) => $query->whereKeyNot($currentTokenId))
            ->delete();

        $refreshTokensRevoked = RefreshToken::query()
            ->where('user_id', $user->id)
            ->whereNull('revoked_at')
            ->when($currentDeviceId !== null, function ($query) use ($currentDeviceId): void {
                $query->where(function ($query) use ($currentDeviceId): void {
                    $query->whereNull('device_id')->orWhere('device_id', '!=', $currentDeviceId);
                });
            })
            ->update(['revoked_at' => now()]);

        return [
            'access_tokens_revoked' => (int) $accessTokensRevoked,
            'refresh_tokens_revoked' => $refreshTokensRevoked,
        ];
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
    private function issueTokenPair(User $user, string $deviceName, ?string $deviceId = null, ?string $familyId = null): array
    {
        /** @var Device|null $device */
        $device = $deviceId === null
            ? null
            : Device::query()->whereKey($deviceId)->where('user_id', $user->id)->first();

        if ($device instanceof Device) {
            $device->forceFill(['last_used_at' => now()])->save();
        } else {
            /** @var Device $device */
            $device = Device::query()->create([
                'user_id' => $user->id,
                'name' => $deviceName,
                'last_used_at' => now(),
            ]);
        }

        $accessMinutes = (int) config('trominal.access_token_expiration_minutes', 15);
        $plainRefreshToken = bin2hex(random_bytes(64));

        /** @var RefreshToken $refreshToken */
        $refreshToken = RefreshToken::query()->create([
            'user_id' => $user->id,
            'device_id' => $device->id,
            'family_id' => $familyId,
            'token_hash' => hash('sha256', $plainRefreshToken),
            'expires_at' => now()->addDays(RefreshToken::lifetimeDays()),
        ]);

        if ($familyId === null) {
            // A fresh sign-in starts a new family rooted at its first token.
            $refreshToken->forceFill(['family_id' => $refreshToken->getKey()])->save();
        }

        $accessToken = $user->createToken(
            name: $device->name,
            abilities: ['*'],
            expiresAt: now()->addMinutes($accessMinutes),
        );
        $accessToken->accessToken->forceFill(['device_id' => $device->id])->save();

        return [
            'user' => $user->fresh(['roles', 'permissions']) ?? $user,
            'access_token' => $accessToken->plainTextToken,
            'refresh_token' => $plainRefreshToken,
            'token_type' => 'Bearer',
            'expires_in' => $accessMinutes * 60,
        ];
    }

    /**
     * Verify a code against the active factor only. A pending (unconfirmed)
     * secret is never accepted for sign-in or step-up.
     */
    private function verifyTwoFactorCode(User $user, string $code): bool
    {
        if ($user->two_fa_enabled_at === null) {
            return false;
        }

        return $this->codes->match($user->two_fa_secret_enc, $code) !== null;
    }
}
