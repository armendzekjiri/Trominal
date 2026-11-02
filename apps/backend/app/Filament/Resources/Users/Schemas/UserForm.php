<?php

declare(strict_types=1);

namespace App\Filament\Resources\Users\Schemas;

use App\Models\User;
use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
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
                            ->maxLength(255)
                            // Older vault envelopes are authenticated with the email
                            // address; changing it before the user's client re-binds
                            // the envelope to the account ID would lock them out.
                            ->disabled(fn ($record): bool => $record instanceof User && $record->private_key_ad_version !== User::PRIVATE_KEY_AD_USER_ID)
                            ->helperText(fn ($record): ?string => $record instanceof User && $record->private_key_ad_version !== User::PRIVATE_KEY_AD_USER_ID
                                ? (string) __('Locked until the user unlocks their vault once with an up-to-date client.')
                                : null),
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
                        // Not the suspended_at column: EditUser routes changes
                        // through UserSuspensionService so suspension always
                        // ends the user's sessions.
                        Toggle::make('suspended')
                            ->label('Suspended')
                            ->helperText('Suspending signs the user out everywhere and revokes all API and refresh tokens.')
                            ->disabled(fn ($record): bool => $record?->is(auth()->user()) ?? false),
                    ])
                    ->columns(2),
            ]);
    }
}
