<?php

declare(strict_types=1);

namespace App\Filament\Resources\Roles\Tables;

use App\Models\Role;
use App\Models\User;
use App\Services\RoleAdministrationService;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Support\Collection;

class RolesTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('name')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('permissions.name')
                    ->badge()
                    ->limitList(4),
                TextColumn::make('users_count')
                    ->counts('users')
                    ->label('Users')
                    ->sortable(),
                TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->recordActions([
                EditAction::make(),
                DeleteAction::make()
                    ->visible(fn (Role $record): bool => ! $record->isDefault())
                    ->using(fn (Role $record, RoleAdministrationService $roles): bool => $roles->delete(self::actor(), $record)),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make()
                        ->using(function (Collection $records, DeleteBulkAction $action, RoleAdministrationService $roles): void {
                            // Default roles are skipped (and reported as failures)
                            // so a bulk selection can never remove them.
                            $records->each(function (mixed $record) use ($action, $roles): void {
                                if (! $record instanceof Role || ! $roles->delete(self::actor(), $record)) {
                                    $action->reportBulkProcessingFailure();
                                }
                            });
                        }),
                ]),
            ])
            ->defaultSort('name');
    }

    private static function actor(): ?User
    {
        $user = auth()->user();

        return $user instanceof User ? $user : null;
    }
}
