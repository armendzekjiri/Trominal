<?php

declare(strict_types=1);

namespace App\Filament\Resources\Teams\Tables;

use App\Models\AuditLog;
use App\Models\Team;
use App\Models\User;
use Filament\Actions\DeleteAction;
use Filament\Actions\ViewAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class TeamsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('id')
                    ->label('Team ID')
                    ->searchable()
                    ->copyable(),
                TextColumn::make('creator.email')
                    ->label('Created by')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('members_count')
                    ->counts('members')
                    ->label('Members')
                    ->sortable(),
                TextColumn::make('key_version')
                    ->label('Key version')
                    ->badge()
                    ->sortable(),
                TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable(),
                TextColumn::make('updated_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->recordActions([
                ViewAction::make(),
                DeleteAction::make()
                    ->requiresConfirmation()
                    ->after(function (Team $record): void {
                        AuditLog::record(
                            actor: auth()->user() instanceof User ? auth()->user() : null,
                            action: 'admin.team.deleted',
                            resourceType: 'team',
                            resourceId: (string) $record->id,
                        );
                    }),
            ])
            ->defaultSort('created_at', 'desc');
    }
}
