<?php

declare(strict_types=1);

namespace App\Support\Vault;

use App\Models\AiSetting;
use App\Models\Group;
use App\Models\Host;
use App\Models\HostCredential;
use App\Models\Identity;
use App\Models\Snippet;
use App\Models\Tunnel;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;

final class VaultResourceRegistry
{
    /**
     * @return array<string, array{
     *     model: class-string<Model>,
     *     permissions: array{read: string, create: string, update: string, delete: string},
     *     fields: list<string>,
     *     required: list<string>,
     *     relationship_fields: array<string, class-string<Model>>
     * }>
     */
    public static function all(): array
    {
        return [
            'groups' => [
                'model' => Group::class,
                'permissions' => self::hostPermissions(),
                'fields' => ['parent_id', 'name_ciphertext', 'name_nonce', 'color_ciphertext', 'color_nonce', 'sort_order'],
                'required' => ['name_ciphertext', 'name_nonce'],
                'relationship_fields' => ['parent_id' => Group::class],
            ],
            'hosts' => [
                'model' => Host::class,
                'permissions' => self::hostPermissions(),
                'fields' => ['group_id', 'name_ciphertext', 'name_nonce', 'hostname_ciphertext', 'hostname_nonce', 'port_ciphertext', 'port_nonce', 'username_ciphertext', 'username_nonce', 'tags_ciphertext', 'tags_nonce', 'color_ciphertext', 'color_nonce'],
                'required' => ['name_ciphertext', 'name_nonce', 'hostname_ciphertext', 'hostname_nonce'],
                'relationship_fields' => ['group_id' => Group::class],
            ],
            'snippets' => [
                'model' => Snippet::class,
                'permissions' => [
                    'read' => 'snippets.read',
                    'create' => 'snippets.create',
                    'update' => 'snippets.update',
                    'delete' => 'snippets.delete',
                ],
                'fields' => ['title_ciphertext', 'title_nonce', 'body_ciphertext', 'body_nonce', 'tags_ciphertext', 'tags_nonce', 'variables_ciphertext', 'variables_nonce'],
                'required' => ['title_ciphertext', 'title_nonce', 'body_ciphertext', 'body_nonce'],
                'relationship_fields' => [],
            ],
            'identities' => [
                'model' => Identity::class,
                'permissions' => [
                    'read' => 'identities.read',
                    'create' => 'identities.create',
                    'update' => 'identities.update',
                    'delete' => 'identities.delete',
                ],
                'fields' => ['name_ciphertext', 'name_nonce', 'key_type', 'public_key_ciphertext', 'public_key_nonce', 'private_key_ciphertext', 'private_key_nonce'],
                'required' => ['name_ciphertext', 'name_nonce', 'private_key_ciphertext', 'private_key_nonce'],
                'relationship_fields' => [],
            ],
            'tunnels' => [
                'model' => Tunnel::class,
                'permissions' => [
                    'read' => 'tunnels.read',
                    'create' => 'tunnels.create',
                    'update' => 'tunnels.update',
                    'delete' => 'tunnels.delete',
                ],
                'fields' => ['host_id', 'name_ciphertext', 'name_nonce', 'config_ciphertext', 'config_nonce', 'enabled'],
                'required' => ['name_ciphertext', 'name_nonce', 'config_ciphertext', 'config_nonce'],
                'relationship_fields' => ['host_id' => Host::class],
            ],
            'ai-settings' => [
                'model' => AiSetting::class,
                'permissions' => [
                    'read' => 'ai.use',
                    'create' => 'ai.use',
                    'update' => 'ai.use',
                    'delete' => 'ai.use',
                ],
                'fields' => ['provider_ciphertext', 'provider_nonce', 'model_ciphertext', 'model_nonce', 'api_key_ciphertext', 'api_key_nonce', 'settings_ciphertext', 'settings_nonce'],
                'required' => [],
                'relationship_fields' => [],
            ],
            'host-credentials' => [
                'model' => HostCredential::class,
                'permissions' => self::hostPermissions(),
                'fields' => ['host_id', 'identity_id', 'label_ciphertext', 'label_nonce', 'username_ciphertext', 'username_nonce', 'password_ciphertext', 'password_nonce', 'private_key_passphrase_ciphertext', 'private_key_passphrase_nonce'],
                'required' => ['label_ciphertext', 'label_nonce'],
                'relationship_fields' => ['host_id' => Host::class, 'identity_id' => Identity::class],
            ],
        ];
    }

    /**
     * @return array{
     *     model: class-string<Model>,
     *     permissions: array{read: string, create: string, update: string, delete: string},
     *     fields: list<string>,
     *     required: list<string>,
     *     relationship_fields: array<string, class-string<Model>>
     * }
     */
    public static function get(string $type): array
    {
        $resources = self::all();

        if (! array_key_exists($type, $resources)) {
            throw new InvalidArgumentException("Unknown vault resource type [{$type}].");
        }

        return $resources[$type];
    }

    /**
     * @return array<string, class-string<Model>>
     */
    public static function modelMap(): array
    {
        return array_map(
            static fn (array $resource): string => $resource['model'],
            self::all(),
        );
    }

    /**
     * @return array{read: string, create: string, update: string, delete: string}
     */
    private static function hostPermissions(): array
    {
        return [
            'read' => 'hosts.read',
            'create' => 'hosts.create',
            'update' => 'hosts.update',
            'delete' => 'hosts.delete',
        ];
    }
}
