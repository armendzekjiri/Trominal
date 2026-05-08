<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/**
 * @property array<string, mixed> $value
 */
#[Fillable(['key', 'value'])]
final class AppSetting extends Model
{
    use HasUlids;

    public const string REGISTRATION = 'registration';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'value' => 'array',
        ];
    }

    public static function registration(): self
    {
        /** @var self $setting */
        $setting = self::query()->firstOrCreate(
            ['key' => self::REGISTRATION],
            ['value' => self::defaultRegistrationValue()],
        );

        return $setting;
    }

    /**
     * @param  array{mode: string, open: bool, instance_name: string, web_ssh_enabled: bool}  $value
     */
    public static function setRegistration(array $value): self
    {
        /** @var self $setting */
        $setting = self::query()->updateOrCreate(
            ['key' => self::REGISTRATION],
            ['value' => $value],
        );

        return $setting;
    }

    /**
     * @return array{mode: string, open: bool, instance_name: string, web_ssh_enabled: bool}
     */
    public static function defaultRegistrationValue(): array
    {
        return [
            'mode' => 'single',
            'open' => true,
            'instance_name' => 'Trominal',
            'web_ssh_enabled' => false,
        ];
    }
}
