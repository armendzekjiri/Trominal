<?php

declare(strict_types=1);

namespace App\Filament\Resources\Teams;

use App\Filament\Resources\Teams\Pages\ListTeams;
use App\Filament\Resources\Teams\Pages\ViewTeam;
use App\Filament\Resources\Teams\RelationManagers\MembersRelationManager;
use App\Filament\Resources\Teams\Tables\TeamsTable;
use App\Models\Team;
use BackedEnum;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Pages\PageRegistration;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;
use UnitEnum;

class TeamResource extends Resource
{
    protected static ?string $model = Team::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    protected static string|UnitEnum|null $navigationGroup = 'Administration';

    protected static ?string $recordTitleAttribute = 'id';

    public static function canViewAny(): bool
    {
        return auth()->user()?->can('admin.teams.manage') ?? false;
    }

    public static function canView(Model $record): bool
    {
        return auth()->user()?->can('admin.teams.manage') ?? false;
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function canEdit(Model $record): bool
    {
        return false;
    }

    public static function canDelete(Model $record): bool
    {
        return auth()->user()?->can('admin.teams.manage') ?? false;
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextEntry::make('id')
                    ->label('Team ID')
                    ->copyable(),
                TextEntry::make('creator.email')
                    ->label('Created by')
                    ->placeholder('Unknown'),
                TextEntry::make('key_version')
                    ->label('Key version')
                    ->badge(),
                TextEntry::make('members_count')
                    ->counts('members')
                    ->label('Members'),
                TextEntry::make('created_at')
                    ->dateTime(),
                TextEntry::make('updated_at')
                    ->dateTime(),
            ])
            ->columns(2);
    }

    public static function table(Table $table): Table
    {
        return TeamsTable::configure($table);
    }

    /**
     * @return array<class-string>
     */
    public static function getRelations(): array
    {
        return [
            MembersRelationManager::class,
        ];
    }

    /**
     * @return array<string, PageRegistration>
     */
    public static function getPages(): array
    {
        return [
            'index' => ListTeams::route('/'),
            'view' => ViewTeam::route('/{record}'),
        ];
    }
}
