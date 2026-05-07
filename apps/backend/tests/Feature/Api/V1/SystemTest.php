<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class SystemTest extends TestCase
{
    use RefreshDatabase;

    public function test_returns_public_server_info(): void
    {
        $this->getJson('/api/server-info')
            ->assertOk()
            ->assertJsonPath('instance_name', 'Trominal')
            ->assertJsonPath('registration_mode', 'single')
            ->assertJsonPath('registration_open', true)
            ->assertJsonPath('web_ssh_enabled', true);
    }

    public function test_returns_basic_health_information(): void
    {
        $response = $this->getJson('/api/health')
            ->assertOk()
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('database', true);

        self::assertIsBool($response->json('redis'));
    }
}
