<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AuditLog;
use App\Models\PersonalAccessToken;
use App\Models\RefreshToken;
use App\Models\User;
use App\Support\Vault\SerializesVaultRecords;
use App\Support\Vault\VaultResourceRegistry;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Throwable;

/**
 * Applies client-side vault key changes atomically.
 *
 * The server cannot decrypt anything, so it enforces what it can: the client
 * started from the current vault_version, the submitted records are exactly
 * the user's current personal records (each unchanged since the client read
 * it), and every encrypted field of each record was replaced. Either all key
 * material changes together or nothing does.
 */
final class VaultRotationService
{
    use SerializesVaultRecords;

    public function __construct(private readonly AuthService $authService) {}

    /**
     * @param  array{
     *     vault_version: int,
     *     current_password: string,
     *     two_factor_code: ?string,
     *     current_refresh_token: string,
     *     new_kdf_salt: string,
     *     new_kdf_params: array{version: int, alg: string, memlimit: int, opslimit: int, salt_len: int, out_len: int},
     *     private_key_ciphertext: string,
     *     private_key_nonce: string,
     *     items: list<array{type: string, id: string, updated_at: ?string, fields: array<string, mixed>}>
     * }  $payload
     */
    public function rotateMasterPassword(User $user, ?PersonalAccessToken $currentAccessToken, array $payload): User
    {
        try {
            $this->authService->assertStepUp($user, $payload['current_password'], $payload['two_factor_code']);

            /** @var User $rotated */
            $rotated = DB::transaction(function () use ($user, $currentAccessToken, $payload): User {
                $locked = $this->lockUser($user, $payload['vault_version']);
                $currentRefreshToken = $this->lockCurrentRefreshToken($locked, $payload['current_refresh_token']);
                $updated = $this->replacePersonalRecords($locked, $payload['items']);

                $locked->forceFill([
                    'kdf_salt' => $payload['new_kdf_salt'],
                    'kdf_params' => $payload['new_kdf_params'],
                    'private_key_ciphertext' => $payload['private_key_ciphertext'],
                    'private_key_nonce' => $payload['private_key_nonce'],
                    'private_key_ad_version' => User::PRIVATE_KEY_AD_USER_ID,
                    'vault_version' => $locked->vault_version + 1,
                ])->save();

                RefreshToken::query()
                    ->where('user_id', $locked->id)
                    ->whereKeyNot($currentRefreshToken->getKey())
                    ->whereNull('revoked_at')
                    ->update(['revoked_at' => now()]);

                $locked->tokens()
                    ->when(
                        $currentAccessToken !== null,
                        fn ($query) => $query->whereKeyNot($currentAccessToken?->getKey()),
                    )
                    ->delete();

                AuditLog::record($locked, 'vault.master_password.changed', 'user', (string) $locked->id, [
                    'items' => $updated,
                    'vault_version' => $locked->vault_version,
                ]);

                return $locked;
            });
        } catch (ValidationException|ConflictHttpException $exception) {
            $this->recordRejection($user, 'vault.master_password.change_rejected', $exception);

            throw $exception;
        }

        return $rotated;
    }

    /**
     * One-time move of a legacy email-bound private-key envelope to the
     * user-ID-bound associated data. The vault key itself does not change.
     */
    public function rebindPrivateKey(User $user, int $vaultVersion, string $ciphertext, string $nonce): User
    {
        try {
            /** @var User $rebound */
            $rebound = DB::transaction(function () use ($user, $vaultVersion, $ciphertext, $nonce): User {
                $locked = $this->lockUser($user, $vaultVersion);

                if ($locked->private_key_ad_version !== User::PRIVATE_KEY_AD_EMAIL) {
                    throw new ConflictHttpException(__('The private key is already bound to the account ID.'));
                }

                $locked->forceFill([
                    'private_key_ciphertext' => $ciphertext,
                    'private_key_nonce' => $nonce,
                    'private_key_ad_version' => User::PRIVATE_KEY_AD_USER_ID,
                    'vault_version' => $locked->vault_version + 1,
                ])->save();

                AuditLog::record($locked, 'vault.private_key.rebound', 'user', (string) $locked->id, [
                    'vault_version' => $locked->vault_version,
                    'private_key_ad_version' => User::PRIVATE_KEY_AD_USER_ID,
                ]);

                return $locked;
            });
        } catch (ValidationException|ConflictHttpException $exception) {
            $this->recordRejection($user, 'vault.private_key.rebind_rejected', $exception);

            throw $exception;
        }

        return $rebound;
    }

    private function lockUser(User $user, int $expectedVaultVersion): User
    {
        /** @var User $locked */
        $locked = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();

        if ($locked->vault_version !== $expectedVaultVersion) {
            throw new ConflictHttpException(__('The vault changed on another device. Reload and try again.'));
        }

        return $locked;
    }

    private function lockCurrentRefreshToken(User $user, string $plainRefreshToken): RefreshToken
    {
        /** @var RefreshToken|null $token */
        $token = RefreshToken::query()
            ->where('user_id', $user->id)
            ->where('token_hash', hash('sha256', $plainRefreshToken))
            ->lockForUpdate()
            ->first();

        if (! $token instanceof RefreshToken || ! $token->isUsable()) {
            throw ValidationException::withMessages([
                'current_refresh_token' => __('The current session is invalid. Sign in again.'),
            ]);
        }

        return $token;
    }

    /**
     * @param  list<array{type: string, id: string, updated_at: ?string, fields: array<string, mixed>}>  $items
     * @return int Number of records updated.
     */
    private function replacePersonalRecords(User $user, array $items): int
    {
        /** @var array<string, array<string, array{updated_at: ?string, fields: array<string, mixed>}>> $submitted */
        $submitted = [];

        foreach ($items as $item) {
            if (isset($submitted[$item['type']][$item['id']])) {
                throw ValidationException::withMessages([
                    'items' => __('Each vault record may appear only once.'),
                ]);
            }

            $submitted[$item['type']][$item['id']] = [
                'updated_at' => $item['updated_at'],
                'fields' => $item['fields'],
            ];
        }

        $updated = 0;

        foreach (VaultResourceRegistry::all() as $type => $resource) {
            $modelClass = $resource['model'];

            /** @var Collection<int, Model> $records */
            $records = $modelClass::query()
                ->where('user_id', $user->id)
                ->when($resource['team_scoped'], fn ($query) => $query->whereNull('team_id'))
                ->lockForUpdate()
                ->get();

            $forType = $submitted[$type] ?? [];
            $currentIds = $records->map(static fn (Model $record): string => (string) $record->getKey())->all();
            $submittedIds = array_map('strval', array_keys($forType));
            sort($currentIds);
            sort($submittedIds);

            if ($currentIds !== $submittedIds) {
                throw new ConflictHttpException(__('The vault changed on another device. Reload and try again.'));
            }

            $cipherColumns = $this->cipherColumns($resource['fields']);

            foreach ($records as $record) {
                $item = $forType[(string) $record->getKey()];

                if ($this->formatTimestamp($record->getAttribute('updated_at')) !== $item['updated_at']) {
                    throw new ConflictHttpException(__('The vault changed on another device. Reload and try again.'));
                }

                $record->forceFill($this->validatedCipherFields($record, $item['fields'], $cipherColumns))->save();
                $updated++;
            }
        }

        return $updated;
    }

    /**
     * @param  list<string>  $fields
     * @return list<string> Encrypted field base names, e.g. "name" for name_ciphertext/name_nonce.
     */
    private function cipherColumns(array $fields): array
    {
        $bases = [];

        foreach ($fields as $field) {
            if (str_ends_with($field, '_ciphertext') && in_array(substr($field, 0, -11).'_nonce', $fields, true)) {
                $bases[] = substr($field, 0, -11);
            }
        }

        return $bases;
    }

    /**
     * Every encrypted column that currently holds data must be replaced, in
     * ciphertext/nonce pairs, and nothing else may be touched.
     *
     * @param  array<string, mixed>  $fields
     * @param  list<string>  $cipherColumns
     * @return array<string, string>
     */
    private function validatedCipherFields(Model $record, array $fields, array $cipherColumns): array
    {
        $allowed = [];

        foreach ($cipherColumns as $base) {
            $allowed["{$base}_ciphertext"] = $base;
            $allowed["{$base}_nonce"] = $base;
        }

        $invalid = static fn (): ValidationException => ValidationException::withMessages([
            'items' => __('Every encrypted field of every vault record must be re-encrypted, and nothing else.'),
        ]);

        $replacements = [];

        foreach ($fields as $field => $value) {
            if (! array_key_exists((string) $field, $allowed) || ! is_string($value) || $value === '' || strlen($value) > 1_048_576) {
                throw $invalid();
            }

            $replacements[(string) $field] = $value;
        }

        foreach ($cipherColumns as $base) {
            $hasCiphertext = array_key_exists("{$base}_ciphertext", $fields);
            $hasNonce = array_key_exists("{$base}_nonce", $fields);

            if ($hasCiphertext !== $hasNonce) {
                throw $invalid();
            }

            $stored = $record->getAttribute("{$base}_ciphertext");

            if ($stored !== null && $stored !== '' && ! $hasCiphertext) {
                throw $invalid();
            }
        }

        return $replacements;
    }

    private function recordRejection(User $user, string $action, Throwable $exception): void
    {
        $reason = $exception instanceof ConflictHttpException
            ? 'conflict'
            : implode(',', array_keys($exception instanceof ValidationException ? $exception->errors() : []));

        AuditLog::record($user, $action, 'user', (string) $user->id, ['reason' => $reason]);
    }
}
