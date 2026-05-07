<?php

declare(strict_types=1);

namespace App\Filament\Pages\Auth;

use App\Models\AppSetting;
use App\Services\AuthService;
use Filament\Auth\Pages\Register;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class RegisterFirstAdmin extends Register
{
    public function mount(): void
    {
        abort_unless($this->canBootstrapFirstAdmin(), 404);

        parent::mount();
    }

    public function getTitle(): string
    {
        return 'Create first admin';
    }

    public function getHeading(): string
    {
        return 'Create first admin';
    }

    /**
     * @param  array<string, mixed>  $data
     */
    protected function handleRegistration(array $data): Model
    {
        $tokenPair = app(AuthService::class)->register([
            ...$data,
            ...$this->temporaryVaultBootstrapPayload(),
            'device_name' => 'Filament admin bootstrap',
        ]);

        return $tokenPair['user'];
    }

    private function canBootstrapFirstAdmin(): bool
    {
        /** @var AppSetting $setting */
        $setting = AppSetting::registration();
        $value = $setting->value;
        $mode = (string) ($value['mode'] ?? 'single');
        $isOpen = (bool) ($value['open'] ?? false);

        return $isOpen
            && $mode !== 'closed'
            && DB::table('users')->count() === 0;
    }

    /**
     * These placeholders satisfy the zero-knowledge vault columns until the
     * client-side vault setup flow exists and can replace them with real keys.
     *
     * @return array<string, mixed>
     */
    private function temporaryVaultBootstrapPayload(): array
    {
        return [
            'kdf_salt' => base64_encode(random_bytes(16)),
            'kdf_params' => [
                'version' => 1,
                'alg' => 'temporary-filament-bootstrap',
                'memlimit' => 0,
                'opslimit' => 0,
                'salt_len' => 16,
                'out_len' => 32,
            ],
            'public_key' => base64_encode(random_bytes(32)),
            'private_key_ciphertext' => base64_encode(random_bytes(80)),
            'private_key_nonce' => base64_encode(random_bytes(24)),
        ];
    }
}
