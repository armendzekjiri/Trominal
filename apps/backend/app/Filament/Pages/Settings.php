<?php

declare(strict_types=1);

namespace App\Filament\Pages;

use App\Models\AppSetting;
use App\Models\AuditLog;
use App\Models\User;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Support\Icons\Heroicon;
use UnitEnum;

class Settings extends Page
{
    protected string $view = 'filament.pages.settings';

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    protected static string|UnitEnum|null $navigationGroup = 'Operations';

    public static function canAccess(): bool
    {
        return auth()->user()?->can('admin.settings.manage') ?? false;
    }

    /**
     * @return array{mode: string, open: bool, instance_name: string, web_ssh_enabled: bool}
     */
    public function settings(): array
    {
        $value = AppSetting::registration()->value;

        return [
            'mode' => (string) ($value['mode'] ?? 'single'),
            'open' => (bool) ($value['open'] ?? false),
            'instance_name' => (string) ($value['instance_name'] ?? 'Trominal'),
            'web_ssh_enabled' => (bool) ($value['web_ssh_enabled'] ?? true),
        ];
    }

    protected function getHeaderActions(): array
    {
        return [
            Action::make('updateSettings')
                ->label('Edit settings')
                ->fillForm(fn (): array => $this->settings())
                ->form([
                    TextInput::make('instance_name')
                        ->required()
                        ->maxLength(80),
                    Select::make('mode')
                        ->label('Registration mode')
                        ->options([
                            'single' => 'Single user (first signup becomes admin, then closes)',
                            'open' => 'Open (anyone can sign up)',
                            'invite' => 'Invite only',
                            'closed' => 'Closed',
                        ])
                        ->helperText('In single mode the API auto-closes registration after the first user, so switching this toggle alone is not enough — pick "Open" to keep accepting public signups.')
                        ->required(),
                    Toggle::make('open')
                        ->label('Registration open')
                        ->helperText('Must be on for any signup to succeed. The API resets this to off automatically after the first single-mode user.'),
                    Toggle::make('web_ssh_enabled')
                        ->label('Web SSH enabled'),
                ])
                ->action(function (array $data): void {
                    $setting = AppSetting::setRegistration([
                        'mode' => (string) $data['mode'],
                        'open' => (bool) $data['open'],
                        'instance_name' => (string) $data['instance_name'],
                        'web_ssh_enabled' => (bool) $data['web_ssh_enabled'],
                    ]);

                    AuditLog::record(
                        actor: auth()->user() instanceof User ? auth()->user() : null,
                        action: 'admin.settings.updated',
                        resourceType: 'app_settings',
                        resourceId: (string) $setting->id,
                        metadata: [
                            'keys' => array_keys($data),
                        ],
                    );

                    Notification::make()
                        ->success()
                        ->title('Settings updated')
                        ->send();
                }),
        ];
    }
}
