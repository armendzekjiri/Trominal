<?php

declare(strict_types=1);

namespace App\Filament\Resources\Invites\Schemas;

use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;

class InviteForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('Invite')
                    ->schema([
                        TextInput::make('email')
                            ->label('Email address')
                            ->email()
                            ->maxLength(255),
                        DateTimePicker::make('expires_at')
                            ->seconds(false),
                        DateTimePicker::make('used_at')
                            ->label('Used or revoked at')
                            ->disabled(),
                    ])
                    ->columns(2),
            ]);
    }
}
