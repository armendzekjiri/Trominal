<?php

declare(strict_types=1);

namespace App\Filament\Resources\AuditLogs\Tables;

use App\Models\AuditLog;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class AuditLogsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable(),
                TextColumn::make('actor.email')
                    ->label('Actor')
                    ->searchable()
                    ->placeholder('System'),
                TextColumn::make('action')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('resource_type')
                    ->searchable()
                    ->toggleable(),
                TextColumn::make('resource_id')
                    ->searchable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('ip_address')
                    ->searchable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('user_agent')
                    ->limit(48)
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('action')
                    ->options(fn (): array => AuditLog::query()
                        ->select('action')
                        ->distinct()
                        ->orderBy('action')
                        ->pluck('action', 'action')
                        ->all()),
                SelectFilter::make('resource_type')
                    ->options(fn (): array => AuditLog::query()
                        ->whereNotNull('resource_type')
                        ->select('resource_type')
                        ->distinct()
                        ->orderBy('resource_type')
                        ->pluck('resource_type', 'resource_type')
                        ->all()),
            ])
            ->defaultSort('created_at', 'desc');
    }
}
