<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Models\AiSetting;
use App\Models\AuditLog;
use App\Models\Group;
use App\Models\Host;
use App\Models\HostCredential;
use App\Models\Identity;
use App\Models\PersonalAccessToken;
use App\Models\RefreshToken;
use App\Models\Snippet;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\Tunnel;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Auth\AuthManager;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;
use Tests\Support\VaultKeyMaterial;
use Tests\TestCase;

/**
 * Master-password rotation and private-key AD migration with real
 * Argon2id + XChaCha20-Poly1305 material, mirroring what the client sends.
 */
final class VaultRotationTest extends TestCase
{
    use RefreshDatabase;

    private const string LOGIN_PASSWORD = 'correct-horse-battery-staple';

    private const string MASTER_PASSWORD = 'Disposable-master-2938!';

    private const string NEW_MASTER_PASSWORD = 'Disposable-new-master-9283!';

    /** @var array<string, string> */
    private const array AD_RESOURCES = [
        'groups' => 'group',
        'hosts' => 'host',
        'host-credentials' => 'host_credential',
        'snippets' => 'snippet',
        'identities' => 'identity',
        'tunnels' => 'tunnel',
        'ai-settings' => 'ai_setting',
    ];

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
    }

    public function test_rotation_reencrypts_everything_so_only_the_new_master_password_unlocks(): void
    {
        $account = $this->createAccount();
        $user = $account['user'];
        $records = $this->createPersonalRecordsOfEveryType($user, $account['key']);
        $otherRefreshToken = $this->createRefreshToken($user, 'other-device-refresh-token');
        $otherAccessToken = $user->createToken('Other device')->accessToken;

        $payload = $this->rotationPayload($account);

        $this->postJson('/api/v1/me/master-password/change', $payload, $account['headers'])
            ->assertOk()
            ->assertJsonPath('vault_version', 2)
            ->assertJsonPath('vault.vault_version', 2)
            ->assertJsonPath('vault.private_key_ad_version', 2);

        // Drop the guard's cached user so /me reads the rotated row, as a new request would.
        $this->app->make(AuthManager::class)->forgetGuards();
        $me = $this->getJson('/api/v1/me', $account['headers'])->assertOk()->json('data.vault');
        self::assertIsArray($me);
        $newKey = VaultKeyMaterial::deriveKey(self::NEW_MASTER_PASSWORD, (string) base64_decode((string) $me['kdf_salt'], true));
        $oldPasswordWithNewSalt = VaultKeyMaterial::deriveKey(self::MASTER_PASSWORD, (string) base64_decode((string) $me['kdf_salt'], true));
        $ad = VaultKeyMaterial::privateKeyAd((string) $user->id);

        self::assertSame(
            $account['private_key'],
            VaultKeyMaterial::tryDecrypt($me['private_key_ciphertext'], $me['private_key_nonce'], $newKey, $ad),
            'The canary must decrypt with the key derived from the new password.',
        );
        self::assertNull(VaultKeyMaterial::tryDecrypt($me['private_key_ciphertext'], $me['private_key_nonce'], $account['key'], $ad));
        self::assertNull(VaultKeyMaterial::tryDecrypt($me['private_key_ciphertext'], $me['private_key_nonce'], $oldPasswordWithNewSalt, $ad));
        self::assertSame(VaultKeyMaterial::kdfParams(), $me['kdf_params']);

        foreach ($records as $type => $record) {
            $fresh = $this->getJson("/api/v1/vault/{$type}/{$record['model']->getKey()}", $account['headers'])
                ->assertOk()
                ->json('data');
            self::assertIsArray($fresh);
            $recordAd = VaultKeyMaterial::ad(self::AD_RESOURCES[$type], (string) $record['model']->getKey());

            foreach ($record['plaintext'] as $field => $plaintext) {
                self::assertSame(
                    $plaintext,
                    VaultKeyMaterial::tryDecrypt($fresh["{$field}_ciphertext"], $fresh["{$field}_nonce"], $newKey, $recordAd),
                    "{$type}.{$field} must decrypt with the new key.",
                );
            }
        }

        $user->refresh();
        self::assertSame(2, $user->vault_version);
        self::assertNull(RefreshToken::query()->whereKey($account['refresh_token_id'])->value('revoked_at'));
        self::assertNotNull(RefreshToken::query()->whereKey($otherRefreshToken->id)->value('revoked_at'));
        self::assertFalse(PersonalAccessToken::query()->whereKey($otherAccessToken->getKey())->exists());

        $audit = AuditLog::query()->where('action', 'vault.master_password.changed')->firstOrFail();
        self::assertSame(count($records), $audit->metadata['items'] ?? null);
        self::assertSame(2, $audit->metadata['vault_version'] ?? null);
        self::assertStringNotContainsString(self::LOGIN_PASSWORD, (string) json_encode($audit->metadata));
    }

    public function test_rotation_rejects_an_invalid_refresh_token_without_changing_anything(): void
    {
        $account = $this->createAccount();
        $this->createPersonalRecordsOfEveryType($account['user'], $account['key']);

        $payload = $this->rotationPayload($account);
        $payload['current_refresh_token'] = 'not-a-valid-refresh-token';

        $this->postJson('/api/v1/me/master-password/change', $payload, $account['headers'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['current_refresh_token']);

        $this->assertVaultUnchanged($account);
    }

    public function test_rotation_rejects_refresh_tokens_that_are_revoked_rotated_or_owned_by_someone_else(): void
    {
        $account = $this->createAccount();
        $stranger = $this->createAccount();
        $revoked = $this->createRefreshToken($account['user'], 'revoked-refresh-token');
        $revoked->update(['revoked_at' => now()]);
        $rotated = $this->createRefreshToken($account['user'], 'rotated-refresh-token');
        $rotated->update(['rotated_at' => now()]);

        foreach (['revoked-refresh-token', 'rotated-refresh-token', $stranger['refresh_token']] as $token) {
            $payload = $this->rotationPayload($account);
            $payload['current_refresh_token'] = $token;

            $this->postJson('/api/v1/me/master-password/change', $payload, $account['headers'])
                ->assertUnprocessable()
                ->assertJsonValidationErrors(['current_refresh_token']);
        }

        $this->assertVaultUnchanged($account);
    }

    public function test_rotation_requires_the_current_login_password(): void
    {
        $account = $this->createAccount();

        $payload = $this->rotationPayload($account);
        unset($payload['current_password']);
        $this->postJson('/api/v1/me/master-password/change', $payload, $account['headers'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['current_password']);

        $payload['current_password'] = 'not-the-login-password';
        $this->postJson('/api/v1/me/master-password/change', $payload, $account['headers'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['current_password']);

        $this->assertVaultUnchanged($account);
        self::assertTrue(AuditLog::query()->where('action', 'vault.master_password.change_rejected')->exists());
    }

    public function test_rotation_requires_a_current_totp_code_when_two_factor_is_enabled(): void
    {
        $account = $this->createAccount();
        $secret = (new Google2FA)->generateSecretKey();
        $account['user']->forceFill(['two_fa_secret_enc' => $secret, 'two_fa_enabled_at' => now()])->save();

        $payload = $this->rotationPayload($account);
        $this->postJson('/api/v1/me/master-password/change', $payload, $account['headers'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['two_factor_code']);

        $payload['two_factor_code'] = (new Google2FA)->getCurrentOtp($secret) === '000000' ? '111111' : '000000';
        $this->postJson('/api/v1/me/master-password/change', $payload, $account['headers'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['two_factor_code']);

        $this->assertVaultUnchanged($account);

        $payload['two_factor_code'] = (new Google2FA)->getCurrentOtp($secret);
        $this->postJson('/api/v1/me/master-password/change', $payload, $account['headers'])
            ->assertOk();
    }

    public function test_rotation_rejects_an_incomplete_item_set_and_rolls_back(): void
    {
        $account = $this->createAccount();
        $this->createPersonalRecordsOfEveryType($account['user'], $account['key']);

        $payload = $this->rotationPayload($account);
        array_pop($payload['items']);

        $this->postJson('/api/v1/me/master-password/change', $payload, $account['headers'])
            ->assertConflict();

        $this->assertVaultUnchanged($account);
    }

    public function test_rotation_rejects_items_that_are_not_exactly_the_personal_record_set(): void
    {
        $account = $this->createAccount();
        $stranger = $this->createAccount();
        $records = $this->createPersonalRecordsOfEveryType($account['user'], $account['key']);
        $strangerHost = $this->createHost($stranger['user'], $stranger['key']);
        $team = $this->createTeam($account['user']);
        $teamHost = $this->createHost($account['user'], $account['key'], $team);
        $deletedHost = $this->createHost($account['user'], $account['key']);
        $deletedHost->delete();

        $base = $this->rotationPayload($account);
        /** @var list<array<string, mixed>> $baseItems */
        $baseItems = $base['items'];
        $hostItems = array_values(array_filter($baseItems, static fn (array $item): bool => $item['type'] === 'hosts'));
        $hostItem = $hostItems[0] ?? null;
        self::assertIsArray($hostItem);

        $variants = [
            'foreign record' => [...$base['items'], [...$hostItem, 'id' => $strangerHost->id]],
            'team record' => [...$base['items'], [...$hostItem, 'id' => $teamHost->id]],
            'deleted record' => [...$base['items'], [...$hostItem, 'id' => $deletedHost->id]],
            'unknown id' => [...$base['items'], [...$hostItem, 'id' => Str::lower((string) Str::ulid())]],
            'wrong type' => array_map(
                static fn (array $item): array => $item['type'] === 'hosts' ? [...$item, 'type' => 'snippets'] : $item,
                $base['items'],
            ),
        ];

        foreach ($variants as $name => $items) {
            $this->postJson('/api/v1/me/master-password/change', [...$base, 'items' => $items], $account['headers'])
                ->assertStatus(409);
        }

        $this->postJson('/api/v1/me/master-password/change', [
            ...$base,
            'items' => [...$base['items'], $hostItem],
        ], $account['headers'])->assertUnprocessable()->assertJsonValidationErrors(['items']);

        $this->assertVaultUnchanged($account);
        self::assertCount(count($records), $base['items']);
    }

    public function test_rotation_rejects_a_stale_vault_version(): void
    {
        $account = $this->createAccount();
        $this->createPersonalRecordsOfEveryType($account['user'], $account['key']);
        $payload = $this->rotationPayload($account);
        $account['user']->forceFill(['vault_version' => 2])->save();

        $this->postJson('/api/v1/me/master-password/change', $payload, $account['headers'])
            ->assertConflict();

        $payload['vault_version'] = 3;
        $this->postJson('/api/v1/me/master-password/change', $payload, $account['headers'])
            ->assertConflict();

        $account['user']->forceFill(['vault_version' => 1])->save();
        $this->assertVaultUnchanged($account);
    }

    public function test_rotation_rejects_records_modified_after_the_client_read_them(): void
    {
        $account = $this->createAccount();
        $records = $this->createPersonalRecordsOfEveryType($account['user'], $account['key']);
        $payload = $this->rotationPayload($account);

        $this->travel(5)->seconds();
        $host = $records['hosts']['model'];
        $host->forceFill(['name_ciphertext' => $host->getAttribute('name_ciphertext')])->touch();

        $this->postJson('/api/v1/me/master-password/change', $payload, $account['headers'])
            ->assertConflict();

        $this->assertVaultUnchanged($account);
    }

    public function test_rotation_requires_every_encrypted_field_and_rejects_other_columns(): void
    {
        $account = $this->createAccount();
        $this->createPersonalRecordsOfEveryType($account['user'], $account['key']);
        $base = $this->rotationPayload($account);

        $withoutSnippetVariables = array_map(static function (array $item): array {
            if ($item['type'] === 'snippets') {
                unset($item['fields']['variables_ciphertext'], $item['fields']['variables_nonce']);
            }

            return $item;
        }, $base['items']);

        $withUnpairedNonce = array_map(static function (array $item): array {
            if ($item['type'] === 'hosts') {
                unset($item['fields']['name_nonce']);
            }

            return $item;
        }, $base['items']);

        $withRelationColumn = array_map(static function (array $item): array {
            if ($item['type'] === 'hosts') {
                $item['fields']['group_id'] = null;
            }

            return $item;
        }, $base['items']);

        $withEmptyCiphertext = array_map(static function (array $item): array {
            if ($item['type'] === 'tunnels') {
                $item['fields']['config_ciphertext'] = '';
            }

            return $item;
        }, $base['items']);

        foreach ([$withoutSnippetVariables, $withUnpairedNonce, $withRelationColumn, $withEmptyCiphertext] as $items) {
            $this->postJson('/api/v1/me/master-password/change', [...$base, 'items' => $items], $account['headers'])
                ->assertUnprocessable()
                ->assertJsonValidationErrors(['items']);
        }

        $this->assertVaultUnchanged($account);
    }

    public function test_rotation_enforces_kdf_parameter_and_envelope_bounds(): void
    {
        // Many rejected requests in a row; the rate limit is covered separately.
        $this->withoutMiddleware(ThrottleRequests::class);
        $account = $this->createAccount();
        $base = $this->rotationPayload($account);
        $params = VaultKeyMaterial::kdfParams();

        $invalid = [
            'new_kdf_params' => [
                [...$params, 'version' => 2],
                [...$params, 'alg' => 'argon2i'],
                [...$params, 'memlimit' => 8 * 1024 * 1024],
                [...$params, 'memlimit' => 4 * 1024 * 1024 * 1024],
                [...$params, 'memlimit' => 67108865],
                [...$params, 'opslimit' => 1],
                [...$params, 'opslimit' => 1000],
                [...$params, 'salt_len' => 32],
                [...$params, 'out_len' => 64],
                [...$params, 'extra' => true],
                array_diff_key($params, ['out_len' => true]),
            ],
            'new_kdf_salt' => [
                base64_encode(random_bytes(32)),
                base64_encode(random_bytes(8)),
                'not base64!',
            ],
            'private_key_ciphertext' => [
                base64_encode(random_bytes(80)),
                'not base64!',
            ],
            'private_key_nonce' => [
                base64_encode(random_bytes(12)),
            ],
        ];

        foreach ($invalid as $field => $values) {
            foreach ($values as $value) {
                $this->postJson('/api/v1/me/master-password/change', [...$base, $field => $value], $account['headers'])
                    ->assertUnprocessable()
                    ->assertJsonValidationErrors([$field]);
            }
        }

        $this->assertVaultUnchanged($account);
    }

    public function test_rotation_is_rate_limited_per_user(): void
    {
        $account = $this->createAccount();
        $payload = $this->rotationPayload($account);

        // The route allows 10 attempts per hour per user, whatever the outcome.
        for ($attempt = 0; $attempt < 10; $attempt++) {
            $this->postJson('/api/v1/me/master-password/change', [...$payload, 'vault_version' => 999], $account['headers'])
                ->assertConflict();
        }

        $this->postJson('/api/v1/me/master-password/change', $payload, $account['headers'])
            ->assertTooManyRequests();
    }

    public function test_wrong_step_up_passwords_lock_rotation_out(): void
    {
        config(['trominal.rate_limits.two_factor_max_attempts' => 3]);
        $account = $this->createAccount();
        $payload = [...$this->rotationPayload($account), 'current_password' => 'not-the-login-password'];

        // Step-up failures share the per-account counter with the 2FA endpoints.
        for ($attempt = 0; $attempt < 3; $attempt++) {
            $this->postJson('/api/v1/me/master-password/change', $payload, $account['headers'])
                ->assertUnprocessable();
        }

        $this->postJson('/api/v1/me/master-password/change', $this->rotationPayload($account), $account['headers'])
            ->assertTooManyRequests();
        $this->assertVaultUnchanged($account);
    }

    public function test_vault_writes_are_rejected_once_the_access_token_was_revoked_by_a_rotation(): void
    {
        $account = $this->createAccount();
        $token = $account['user']->createToken('Other device');
        $user = $account['user']->withAccessToken($token->accessToken);
        $token->accessToken->delete();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/vault/snippets', [
                'title_ciphertext' => 'stale-key-ciphertext',
                'title_nonce' => 'stale-key-nonce',
                'body_ciphertext' => 'stale-key-ciphertext',
                'body_nonce' => 'stale-key-nonce',
            ])
            ->assertUnauthorized();

        self::assertSame(0, Snippet::query()->count());
    }

    public function test_me_exposes_vault_version_and_private_key_ad_version(): void
    {
        $account = $this->createAccount(legacyAd: true);

        $this->getJson('/api/v1/me', $account['headers'])
            ->assertOk()
            ->assertJsonPath('data.vault.vault_version', 1)
            ->assertJsonPath('data.vault.private_key_ad_version', 1);
    }

    public function test_legacy_email_bound_envelope_can_be_rebound_to_the_user_id_once(): void
    {
        $account = $this->createAccount(legacyAd: true);
        $user = $account['user'];
        $rebound = VaultKeyMaterial::encrypt($account['private_key'], $account['key'], VaultKeyMaterial::privateKeyAd((string) $user->id));
        $originalSalt = $user->kdf_salt;

        $this->postJson('/api/v1/me/private-key/rebind', [
            'vault_version' => 2,
            'private_key_ciphertext' => $rebound['ciphertext'],
            'private_key_nonce' => $rebound['nonce'],
        ], $account['headers'])->assertConflict();

        $this->postJson('/api/v1/me/private-key/rebind', [
            'vault_version' => 1,
            'private_key_ciphertext' => base64_encode(random_bytes(80)),
            'private_key_nonce' => $rebound['nonce'],
        ], $account['headers'])->assertUnprocessable()->assertJsonValidationErrors(['private_key_ciphertext']);

        $this->postJson('/api/v1/me/private-key/rebind', [
            'vault_version' => 1,
            'private_key_ciphertext' => $rebound['ciphertext'],
            'private_key_nonce' => $rebound['nonce'],
        ], $account['headers'])
            ->assertOk()
            ->assertJsonPath('vault_version', 2)
            ->assertJsonPath('vault.private_key_ad_version', 2);

        $user->refresh();
        self::assertSame($originalSalt, $user->kdf_salt);
        self::assertSame(2, $user->vault_version);
        self::assertSame(
            $account['private_key'],
            VaultKeyMaterial::tryDecrypt($user->private_key_ciphertext, $user->private_key_nonce, $account['key'], VaultKeyMaterial::privateKeyAd((string) $user->id)),
        );
        self::assertTrue(AuditLog::query()->where('action', 'vault.private_key.rebound')->exists());

        $this->postJson('/api/v1/me/private-key/rebind', [
            'vault_version' => 2,
            'private_key_ciphertext' => $rebound['ciphertext'],
            'private_key_nonce' => $rebound['nonce'],
        ], $account['headers'])->assertConflict();
    }

    public function test_email_change_no_longer_breaks_the_id_bound_canary(): void
    {
        $account = $this->createAccount();
        $user = $account['user'];

        $user->forceFill(['email' => 'renamed-by-admin@example.test'])->save();

        $vault = $this->getJson('/api/v1/me', $account['headers'])->assertOk()->json('data.vault');
        self::assertIsArray($vault);
        $key = VaultKeyMaterial::deriveKey(self::MASTER_PASSWORD, (string) base64_decode((string) $vault['kdf_salt'], true));

        self::assertSame(
            $account['private_key'],
            VaultKeyMaterial::tryDecrypt($vault['private_key_ciphertext'], $vault['private_key_nonce'], $key, VaultKeyMaterial::privateKeyAd((string) $user->id)),
        );
    }

    public function test_registration_binds_the_envelope_to_a_client_generated_user_id(): void
    {
        $id = Str::lower((string) Str::ulid());
        $material = $this->freshMaterial();
        $envelope = VaultKeyMaterial::encrypt($material['private_key'], $material['key'], VaultKeyMaterial::privateKeyAd($id));

        $this->postJson('/api/v1/auth/register', [
            ...$this->registrationPayload($material, $envelope),
            'id' => $id,
        ])
            ->assertCreated()
            ->assertJsonPath('user.id', $id)
            ->assertJsonPath('user.vault.private_key_ad_version', 2)
            ->assertJsonPath('user.vault.vault_version', 1);
    }

    public function test_registration_without_an_id_is_marked_as_legacy_bound(): void
    {
        $material = $this->freshMaterial();
        $envelope = VaultKeyMaterial::encrypt($material['private_key'], $material['key'], VaultKeyMaterial::legacyPrivateKeyAd('first@example.test'));

        $this->postJson('/api/v1/auth/register', $this->registrationPayload($material, $envelope))
            ->assertCreated()
            ->assertJsonPath('user.vault.private_key_ad_version', 1);
    }

    public function test_registration_rejects_stale_user_ids_and_out_of_bounds_key_material(): void
    {
        $material = $this->freshMaterial();
        $envelope = VaultKeyMaterial::encrypt($material['private_key'], $material['key'], 'unused');
        $base = $this->registrationPayload($material, $envelope);
        $params = VaultKeyMaterial::kdfParams();

        $invalid = [
            'id' => [(string) Str::ulid(now()->subDay()), 'not-a-ulid'],
            'kdf_params' => [[...$params, 'memlimit' => 1024], [...$params, 'opslimit' => 99], [...$params, 'salt_len' => 8]],
            'kdf_salt' => [base64_encode(random_bytes(32))],
            'private_key_ciphertext' => [base64_encode(random_bytes(80))],
            'private_key_nonce' => [base64_encode(random_bytes(8))],
            'public_key' => [base64_encode(random_bytes(16))],
        ];

        foreach ($invalid as $field => $values) {
            foreach ($values as $value) {
                $this->postJson('/api/v1/auth/register', [...$base, $field => $value])
                    ->assertUnprocessable()
                    ->assertJsonValidationErrors([$field]);
            }
        }

        self::assertSame(0, User::query()->count());
    }

    /**
     * @return array{
     *     user: User,
     *     key: string,
     *     private_key: string,
     *     headers: array{Authorization: string},
     *     refresh_token: string,
     *     refresh_token_id: string,
     *     canary: array{ciphertext: string, nonce: string, salt: string}
     * }
     */
    private function createAccount(bool $legacyAd = false): array
    {
        $material = $this->freshMaterial();
        $id = Str::lower((string) Str::ulid());
        $email = Str::lower(Str::random(12)).'@example.test';
        $envelope = VaultKeyMaterial::encrypt(
            $material['private_key'],
            $material['key'],
            $legacyAd ? VaultKeyMaterial::legacyPrivateKeyAd($email) : VaultKeyMaterial::privateKeyAd($id),
        );

        /** @var User $user */
        $user = User::factory()->create([
            'id' => $id,
            'email' => $email,
            'password' => Hash::make(self::LOGIN_PASSWORD),
            'kdf_salt' => base64_encode($material['salt']),
            'kdf_params' => VaultKeyMaterial::kdfParams(),
            'public_key' => base64_encode($material['public_key']),
            'private_key_ciphertext' => $envelope['ciphertext'],
            'private_key_nonce' => $envelope['nonce'],
        ]);
        $user->forceFill(['private_key_ad_version' => $legacyAd ? 1 : 2])->save();
        $user->assignRole('user');

        $refreshToken = 'refresh-'.Str::random(40);
        $refresh = $this->createRefreshToken($user, $refreshToken);
        $this->app->make(AuthManager::class)->forgetGuards();

        return [
            'user' => $user,
            'key' => $material['key'],
            'private_key' => $material['private_key'],
            'headers' => ['Authorization' => 'Bearer '.$user->createToken('Rotation test')->plainTextToken],
            'refresh_token' => $refreshToken,
            'refresh_token_id' => (string) $refresh->id,
            'canary' => [
                'ciphertext' => $envelope['ciphertext'],
                'nonce' => $envelope['nonce'],
                'salt' => base64_encode($material['salt']),
            ],
        ];
    }

    /**
     * @return array{salt: string, key: string, private_key: string, public_key: string}
     */
    private function freshMaterial(): array
    {
        $salt = random_bytes(16);
        $keyPair = sodium_crypto_box_keypair();

        return [
            'salt' => $salt,
            'key' => VaultKeyMaterial::deriveKey(self::MASTER_PASSWORD, $salt),
            'private_key' => sodium_crypto_box_secretkey($keyPair),
            'public_key' => sodium_crypto_box_publickey($keyPair),
        ];
    }

    /**
     * @param  array{salt: string, key: string, private_key: string, public_key: string}  $material
     * @param  array{ciphertext: string, nonce: string}  $envelope
     * @return array<string, mixed>
     */
    private function registrationPayload(array $material, array $envelope): array
    {
        return [
            'email' => 'first@example.test',
            'password' => self::LOGIN_PASSWORD,
            'password_confirmation' => self::LOGIN_PASSWORD,
            'kdf_salt' => base64_encode($material['salt']),
            'kdf_params' => VaultKeyMaterial::kdfParams(),
            'public_key' => base64_encode($material['public_key']),
            'private_key_ciphertext' => $envelope['ciphertext'],
            'private_key_nonce' => $envelope['nonce'],
            'device_name' => 'Rotation test',
        ];
    }

    private function createRefreshToken(User $user, string $plain): RefreshToken
    {
        /** @var RefreshToken $token */
        $token = RefreshToken::query()->create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $plain),
            'expires_at' => now()->addDay(),
        ]);

        return $token;
    }

    /**
     * Build the rotation request the way the client does: list every personal
     * record, decrypt with the old key, re-encrypt with the new one.
     *
     * @param  array{user: User, key: string, private_key: string, headers: array{Authorization: string}, refresh_token: string}  $account
     * @return array<string, mixed>
     */
    private function rotationPayload(array $account): array
    {
        $newSalt = random_bytes(16);
        $newKey = VaultKeyMaterial::deriveKey(self::NEW_MASTER_PASSWORD, $newSalt);
        $items = [];

        foreach (array_keys(self::AD_RESOURCES) as $type) {
            $records = $this->getJson("/api/v1/vault/{$type}", $account['headers'])->assertOk()->json('data');
            self::assertIsArray($records);

            foreach ($records as $record) {
                $ad = VaultKeyMaterial::ad(self::AD_RESOURCES[$type], (string) $record['id']);
                $items[] = [
                    'type' => $type,
                    'id' => $record['id'],
                    'updated_at' => $record['updated_at'],
                    'fields' => VaultKeyMaterial::reEncryptRecordFields($record, $account['key'], $newKey, $ad),
                ];
            }
        }

        $envelope = VaultKeyMaterial::encrypt($account['private_key'], $newKey, VaultKeyMaterial::privateKeyAd((string) $account['user']->id));

        return [
            'vault_version' => (int) $account['user']->fresh()?->vault_version,
            'current_password' => self::LOGIN_PASSWORD,
            'current_refresh_token' => $account['refresh_token'],
            'new_kdf_salt' => base64_encode($newSalt),
            'new_kdf_params' => VaultKeyMaterial::kdfParams(),
            'private_key_ciphertext' => $envelope['ciphertext'],
            'private_key_nonce' => $envelope['nonce'],
            'items' => $items,
        ];
    }

    /**
     * @param  array{user: User, key: string, private_key: string, canary: array{ciphertext: string, nonce: string, salt: string}}  $account
     */
    private function assertVaultUnchanged(array $account): void
    {
        $user = $account['user']->fresh();
        self::assertInstanceOf(User::class, $user);
        self::assertSame(1, $user->vault_version);
        self::assertSame($account['canary']['salt'], $user->kdf_salt);
        self::assertSame($account['canary']['ciphertext'], $user->private_key_ciphertext);
        self::assertFalse(AuditLog::query()->where('action', 'vault.master_password.changed')->exists());

        $models = [
            'groups' => Group::class,
            'hosts' => Host::class,
            'host-credentials' => HostCredential::class,
            'snippets' => Snippet::class,
            'identities' => Identity::class,
            'tunnels' => Tunnel::class,
            'ai-settings' => AiSetting::class,
        ];

        foreach ($models as $type => $modelClass) {
            /** @var Model $record */
            foreach ($modelClass::query()->withTrashed()->where('user_id', $user->id)->get() as $record) {
                $ad = VaultKeyMaterial::ad(self::AD_RESOURCES[$type], (string) $record->getKey());

                foreach ($record->getAttributes() as $column => $ignored) {
                    if (! str_ends_with($column, '_ciphertext')) {
                        continue;
                    }

                    $ciphertext = $record->getAttribute($column);
                    $nonce = $record->getAttribute(substr($column, 0, -strlen('_ciphertext')).'_nonce');

                    if (! is_string($ciphertext) || ! is_string($nonce)) {
                        continue;
                    }

                    self::assertNotNull(
                        VaultKeyMaterial::tryDecrypt($ciphertext, $nonce, $account['key'], $ad),
                        "{$type}.{$column} must still decrypt with the old key after a rejected rotation.",
                    );
                }
            }
        }
    }

    /**
     * @return array<string, array{model: Model, plaintext: array<string, string>}>
     */
    private function createPersonalRecordsOfEveryType(User $user, string $key): array
    {
        $group = $this->createRecord(Group::class, 'groups', $user, $key, ['name' => 'Production', 'color' => '#22c55e'], ['sort_order' => 1]);
        $host = $this->createRecord(Host::class, 'hosts', $user, $key, [
            'name' => 'db-1',
            'hostname' => '10.0.0.5',
            'port' => '2222',
            'username' => 'deploy',
            'tags' => '["db"]',
        ], ['group_id' => $group['model']->getKey()]);
        $identity = $this->createRecord(Identity::class, 'identities', $user, $key, [
            'name' => 'Deploy key',
            'public_key' => 'ssh-ed25519 AAAA',
            'private_key' => "-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----",
        ], ['key_type' => 'ed25519']);
        $credential = $this->createRecord(HostCredential::class, 'host-credentials', $user, $key, [
            'label' => 'Deploy',
            'username' => 'deploy',
            'password' => 'hunter2',
        ], ['host_id' => $host['model']->getKey(), 'identity_id' => $identity['model']->getKey()]);
        $snippet = $this->createRecord(Snippet::class, 'snippets', $user, $key, [
            'title' => 'Restart',
            'body' => 'sudo systemctl restart app',
            'tags' => '[]',
            'variables' => '{"service":"app"}',
        ]);
        $tunnel = $this->createRecord(Tunnel::class, 'tunnels', $user, $key, [
            'name' => 'Postgres',
            'config' => '{"kind":"local","bindPort":"5432"}',
        ], ['host_id' => $host['model']->getKey(), 'enabled' => true]);
        $ai = $this->createRecord(AiSetting::class, 'ai-settings', $user, $key, [
            'provider' => 'anthropic',
            'model' => 'claude',
            'api_key' => 'sk-test',
            'settings' => '{"features":{}}',
        ]);

        return [
            'groups' => $group,
            'hosts' => $host,
            'identities' => $identity,
            'host-credentials' => $credential,
            'snippets' => $snippet,
            'tunnels' => $tunnel,
            'ai-settings' => $ai,
        ];
    }

    /**
     * @param  class-string<Model>  $modelClass
     * @param  array<string, string>  $plaintext
     * @param  array<string, mixed>  $extra
     * @return array{model: Model, plaintext: array<string, string>}
     */
    private function createRecord(string $modelClass, string $type, User $user, string $key, array $plaintext, array $extra = []): array
    {
        $id = Str::lower((string) Str::ulid());
        $ad = VaultKeyMaterial::ad(self::AD_RESOURCES[$type], $id);
        $attributes = ['id' => $id, 'user_id' => $user->id, ...$extra];

        foreach ($plaintext as $field => $value) {
            $envelope = VaultKeyMaterial::encrypt($value, $key, $ad);
            $attributes["{$field}_ciphertext"] = $envelope['ciphertext'];
            $attributes["{$field}_nonce"] = $envelope['nonce'];
        }

        /** @var Model $record */
        $record = new $modelClass;
        $record->forceFill($attributes)->save();

        return ['model' => $record, 'plaintext' => $plaintext];
    }

    private function createHost(User $user, string $key, ?Team $team = null): Host
    {
        $id = Str::lower((string) Str::ulid());
        $ad = VaultKeyMaterial::ad('host', $id);
        $name = VaultKeyMaterial::encrypt('host', $key, $ad);
        $hostname = VaultKeyMaterial::encrypt('example.test', $key, $ad);

        /** @var Host $host */
        $host = (new Host)->forceFill([
            'id' => $id,
            'user_id' => $user->id,
            'team_id' => $team?->id,
            'name_ciphertext' => $name['ciphertext'],
            'name_nonce' => $name['nonce'],
            'hostname_ciphertext' => $hostname['ciphertext'],
            'hostname_nonce' => $hostname['nonce'],
        ]);
        $host->save();

        return $host;
    }

    private function createTeam(User $owner): Team
    {
        /** @var Team $team */
        $team = Team::query()->create([
            'created_by_user_id' => $owner->id,
            'name_ciphertext' => 'team-name-ciphertext',
            'name_nonce' => 'team-name-nonce',
            'key_version' => 1,
        ]);

        TeamMember::query()->create([
            'team_id' => $team->id,
            'user_id' => $owner->id,
            'role' => TeamMember::ROLE_OWNER,
            'wrapped_team_key_ciphertext' => 'wrapped-key',
            'wrapped_team_key_nonce' => 'wrapped-nonce',
            'key_version' => 1,
        ]);

        return $team;
    }
}
