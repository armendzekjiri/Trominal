<?php

declare(strict_types=1);

namespace App\Filament\Resources\Users\Schemas;

use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;

class UserForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('Account')
                    ->schema([
                        TextInput::make('name')
                            ->maxLength(255),
                        TextInput::make('email')
                            ->label('Email address')
                            ->email()
                            ->required()
                            ->unique(ignoreRecord: true)
                            ->maxLength(255),
                        DateTimePicker::make('email_verified_at'),
                        DateTimePicker::make('two_fa_enabled_at')
                            ->label('2FA enabled at')
                            ->disabled(),
                    ])
                    ->columns(2),
                Section::make('Access')
                    ->schema([
                        Select::make('roles')
                            ->relationship('roles', 'name')
                            ->multiple()
                            ->preload()
                            ->searchable()
                            ->disabled(fn ($record): bool => $record?->is(auth()->user()) ?? false),
                        DateTimePicker::make('suspended_at')
                            ->label('Suspended at')
                            ->disabled(fn ($record): bool => $record?->is(auth()->user()) ?? false),
                    ])
                    ->columns(2),
            ]);
    }
}
