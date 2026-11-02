<?php

declare(strict_types=1);

namespace App\Filament\Resources\Users\Tables;

use App\Exceptions\AdminLockoutException;
use App\Models\AuditLog;
use App\Models\User;
use App\Services\UserSuspensionService;
use Filament\Actions\Action;
use Filament\Actions\EditAction;
use Filament\Notifications\Notification;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;
use Illuminate\Support\Facades\Password;

class UsersTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('name')
                    ->searchable()
                    ->placeholder('Unnamed'),
                TextColumn::make('email')
                    ->label('Email address')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('roles.name')
                    ->badge()
                    ->sortable(),
                TextColumn::make('two_fa_enabled_at')
                    ->label('2FA')
                    ->badge()
                    ->formatStateUsing(fn (mixed $state): string => $state === null ? 'Off' : 'Enabled')
                    ->color(fn (mixed $state): string => $state === null ? 'gray' : 'success')
                    ->sortable(),
                TextColumn::make('suspended_at')
                    ->label('Status')
                    ->badge()
                    ->formatStateUsing(fn (mixed $state): string => $state === null ? 'Active' : 'Suspended')
                    ->color(fn (mixed $state): string => $state === null ? 'success' : 'danger')
                    ->sortable(),
                TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable(),
                TextColumn::make('updated_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('deleted_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('id')
                    ->label('ID')
                    ->searchable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('email_verified_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('kdf_salt')
                    ->label('Vault KDF salt')
                    ->formatStateUsing(fn (): string => 'Stored')
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('private_key_nonce')
                    ->label('Private key nonce')
                    ->formatStateUsing(fn (): string => 'Stored')
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                TernaryFilter::make('suspended')
                    ->nullable()
                    ->queries(
                        true: fn ($query) => $query->whereNotNull('suspended_at'),
                        false: fn ($query) => $query->whereNull('suspended_at'),
                    ),
                SelectFilter::make('roles')
                    ->relationship('roles', 'name')
                    ->preload(),
            ])
            ->recordActions([
                EditAction::make(),
                Action::make('resetPassword')
                    ->label('Reset password')
                    ->requiresConfirmation()
                    ->action(function (User $record): void {
                        Password::sendResetLink(['email' => $record->email]);

                        AuditLog::record(
                            actor: self::actor(),
                            action: 'admin.user.password_reset_requested',
                            resourceType: 'user',
                            resourceId: (string) $record->id,
                        );

                        Notification::make()
                            ->success()
                            ->title('Password reset email queued')
                            ->send();
                    }),
                Action::make('suspend')
                    ->color('danger')
                    ->requiresConfirmation()
                    ->modalDescription('Signs the user out everywhere and revokes all API and refresh tokens.')
                    ->visible(fn (User $record): bool => $record->suspended_at === null && $record->id !== auth()->id())
                    ->action(function (User $record, UserSuspensionService $suspensions): void {
                        try {
                            $suspensions->suspend(self::actor(), $record);
                        } catch (AdminLockoutException $exception) {
                            Notification::make()
                                ->danger()
                                ->title('User not suspended')
                                ->body($exception->getMessage())
                                ->send();

                            return;
                        }

                        Notification::make()
                            ->success()
                            ->title('User suspended')
                            ->send();
                    }),
                Action::make('unsuspend')
                    ->label('Unsuspend')
                    ->color('success')
                    ->requiresConfirmation()
                    ->visible(fn (User $record): bool => $record->suspended_at !== null)
                    ->action(function (User $record, UserSuspensionService $suspensions): void {
                        $suspensions->unsuspend(self::actor(), $record);

                        Notification::make()
                            ->success()
                            ->title('User unsuspended')
                            ->send();
                    }),
            ])
            ->defaultSort('created_at', 'desc');
    }

    private static function actor(): ?User
    {
        $user = auth()->user();

        return $user instanceof User ? $user : null;
    }
}
