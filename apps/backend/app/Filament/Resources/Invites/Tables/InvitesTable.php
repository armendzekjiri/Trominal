<?php

declare(strict_types=1);

namespace App\Filament\Resources\Invites\Tables;

use App\Models\AuditLog;
use App\Models\Invite;
use App\Models\User;
use Filament\Actions\Action;
use Filament\Actions\EditAction;
use Filament\Notifications\Notification;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;

class InvitesTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('email')
                    ->label('Email address')
                    ->searchable()
                    ->placeholder('Any email'),
                TextColumn::make('creator.email')
                    ->label('Created by')
                    ->placeholder('System'),
                TextColumn::make('expires_at')
                    ->dateTime()
                    ->sortable()
                    ->placeholder('No expiry'),
                TextColumn::make('used_at')
                    ->label('Status')
                    ->badge()
                    ->formatStateUsing(fn (mixed $state): string => $state === null ? 'Open' : 'Used/revoked')
                    ->color(fn (mixed $state): string => $state === null ? 'success' : 'gray')
                    ->sortable(),
                TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable(),
            ])
            ->filters([
                TernaryFilter::make('open')
                    ->nullable()
                    ->queries(
                        true: fn ($query) => $query->whereNull('used_at'),
                        false: fn ($query) => $query->whereNotNull('used_at'),
                    ),
            ])
            ->recordActions([
                EditAction::make(),
                Action::make('revoke')
                    ->color('danger')
                    ->requiresConfirmation()
                    ->visible(fn (Invite $record): bool => $record->used_at === null)
                    ->action(function (Invite $record): void {
                        $record->forceFill(['used_at' => now()])->save();

                        AuditLog::record(
                            actor: auth()->user() instanceof User ? auth()->user() : null,
                            action: 'admin.invite.revoked',
                            resourceType: 'invite',
                            resourceId: (string) $record->id,
                        );

                        Notification::make()
                            ->success()
                            ->title('Invite revoked')
                            ->send();
                    }),
            ])
            ->defaultSort('created_at', 'desc');
    }
}
