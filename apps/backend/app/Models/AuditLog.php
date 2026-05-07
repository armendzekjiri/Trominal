<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/**
 * @property array<string, mixed>|null $metadata
 */
#[Fillable([
    'actor_user_id',
    'action',
    'resource_type',
    'resource_id',
    'metadata',
    'ip_address',
    'user_agent',
])]
final class AuditLog extends Model
{
    use HasUlids;

    /**
     * @param  array<string, mixed>  $metadata
     */
    public static function record(
        ?User $actor,
        string $action,
        ?string $resourceType = null,
        ?string $resourceId = null,
        array $metadata = [],
    ): self {
        /** @var self $log */
        $log = self::query()->create([
            'actor_user_id' => $actor?->id,
            'action' => $action,
            'resource_type' => $resourceType,
            'resource_id' => $resourceId,
            'metadata' => $metadata === [] ? null : $metadata,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);

        return $log;
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'metadata' => 'array',
        ];
    }
}
