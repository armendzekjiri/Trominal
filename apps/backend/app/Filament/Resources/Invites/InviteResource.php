<?php

declare(strict_types=1);

namespace App\Filament\Resources\Invites;

use App\Filament\Resources\Invites\Pages\CreateInvite;
use App\Filament\Resources\Invites\Pages\EditInvite;
use App\Filament\Resources\Invites\Pages\ListInvites;
use App\Filament\Resources\Invites\Schemas\InviteForm;
use App\Filament\Resources\Invites\Tables\InvitesTable;
use App\Models\Invite;
use BackedEnum;
use Filament\Resources\Pages\PageRegistration;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;
use UnitEnum;

class InviteResource extends Resource
{
    protected static ?string $model = Invite::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    protected static string|UnitEnum|null $navigationGroup = 'Administration';

    protected static ?string $recordTitleAttribute = 'email';

    public static function canViewAny(): bool
    {
        return auth()->user()?->can('admin.invites.manage') ?? false;
    }

    public static function canCreate(): bool
    {
        return auth()->user()?->can('admin.invites.manage') ?? false;
    }

    public static function canEdit(Model $record): bool
    {
        return auth()->user()?->can('admin.invites.manage') ?? false;
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    public static function form(Schema $schema): Schema
    {
        return InviteForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return InvitesTable::configure($table);
    }

    /**
     * @return array<class-string>
     */
    public static function getRelations(): array
    {
        return [];
    }

    /**
     * @return array<string, PageRegistration>
     */
    public static function getPages(): array
    {
        return [
            'index' => ListInvites::route('/'),
            'create' => CreateInvite::route('/create'),
            'edit' => EditInvite::route('/{record}/edit'),
        ];
    }
}
