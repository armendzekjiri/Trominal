<?php

declare(strict_types=1);

namespace App\Support\Vault;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

trait SerializesVaultRecords
{
    /**
     * @param  list<string>  $fields
     * @return array<string, mixed>
     */
    private function serializeVaultRecord(Model $record, string $type, array $fields): array
    {
        $data = [
            'id' => (string) $record->getKey(),
            'type' => $type,
        ];

        foreach ($fields as $field) {
            $data[$field] = $record->getAttribute($field);
        }

        return [
            ...$data,
            'created_at' => $this->formatTimestamp($record->getAttribute('created_at')),
            'updated_at' => $this->formatTimestamp($record->getAttribute('updated_at')),
            'deleted_at' => $this->formatTimestamp($record->getAttribute('deleted_at')),
        ];
    }

    private function formatTimestamp(mixed $timestamp): ?string
    {
        if ($timestamp instanceof Carbon) {
            return $timestamp->toIso8601String();
        }

        return $timestamp === null ? null : (string) $timestamp;
    }
}
