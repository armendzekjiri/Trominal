<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Models\AppSetting;
use App\Models\User;
use App\Services\AuthService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
use Throwable;

final class RegistrationRaceTest extends TestCase
{
    public function test_handles_parallel_first_user_registrations_atomically(): void
    {
        if (! function_exists('pcntl_fork')) {
            self::markTestSkipped('The pcntl extension is required for the registration race-condition test.');
        }

        $database = $this->temporaryPath('trominal-race-db');
        $startFile = $this->temporaryPath('trominal-race-start');
        $resultFiles = [];
        $children = [];
        $originalDefaultConnection = config('database.default');
        $originalSqliteConnection = config('database.connections.sqlite');

        try {
            $this->useTemporarySqliteDatabase($database);

            Artisan::call('migrate:fresh', [
                '--database' => 'sqlite',
                '--force' => true,
            ]);
            $this->seed(RoleAndPermissionSeeder::class);

            DB::disconnect('sqlite');

            foreach (range(1, 5) as $worker) {
                $resultFile = $this->temporaryPath("trominal-race-result-{$worker}");
                $resultFiles[] = $resultFile;

                $pid = pcntl_fork();

                if ($pid === -1) {
                    self::fail('Unable to fork a registration race-condition worker.');
                }

                if ($pid === 0) {
                    $this->runRegistrationWorker($database, $startFile, $resultFile, $worker);
                }

                $children[] = $pid;
            }

            touch($startFile);

            foreach ($children as $pid) {
                pcntl_waitpid($pid, $status);

                if (! pcntl_wifexited($status) || pcntl_wexitstatus($status) !== 0) {
                    self::fail("Registration race-condition worker {$pid} exited unexpectedly.");
                }
            }

            $this->useTemporarySqliteDatabase($database);

            $results = array_map(
                static fn (string $resultFile): string => trim((string) file_get_contents($resultFile)),
                $resultFiles,
            );
            $errors = array_values(array_filter($results, static fn (string $result): bool => str_starts_with($result, 'error:')));

            self::assertSame(1, count(array_filter($results, static fn (string $result): bool => $result === 'created')));
            self::assertSame([], $errors, implode(PHP_EOL, $errors));
            self::assertSame(1, User::query()->count());
            self::assertFalse((bool) AppSetting::registration()->value['open']);
        } finally {
            DB::purge('sqlite');

            config([
                'database.default' => $originalDefaultConnection,
                'database.connections.sqlite' => $originalSqliteConnection,
            ]);

            foreach ([$database, $startFile, ...$resultFiles] as $path) {
                if (file_exists($path)) {
                    unlink($path);
                }
            }
        }
    }

    private function runRegistrationWorker(string $database, string $startFile, string $resultFile, int $worker): never
    {
        try {
            $this->waitForRaceStart($startFile);
            $this->useTemporarySqliteDatabase($database);

            app(AuthService::class)->register(self::validRegistrationPayload("parallel-{$worker}@example.test"));
            file_put_contents($resultFile, 'created');

            exit(0);
        } catch (AuthorizationException) {
            file_put_contents($resultFile, 'rejected');

            exit(0);
        } catch (Throwable $exception) {
            file_put_contents($resultFile, 'error: '.$exception::class.': '.$exception->getMessage());

            exit(0);
        }
    }

    private function waitForRaceStart(string $startFile): void
    {
        $deadline = microtime(true) + 5.0;

        while (! file_exists($startFile)) {
            if (microtime(true) >= $deadline) {
                throw new \RuntimeException('Timed out waiting for registration race-condition start signal.');
            }

            usleep(1_000);
        }
    }

    private function useTemporarySqliteDatabase(string $database): void
    {
        DB::purge('sqlite');

        $sqlite = config('database.connections.sqlite');

        config([
            'database.default' => 'sqlite',
            'database.connections.sqlite' => [
                ...$sqlite,
                'database' => $database,
                'busy_timeout' => 5_000,
                'journal_mode' => 'WAL',
                'transaction_mode' => 'IMMEDIATE',
            ],
        ]);
    }

    private function temporaryPath(string $prefix): string
    {
        $path = tempnam(sys_get_temp_dir(), $prefix);

        if ($path === false) {
            self::fail("Unable to create temporary path for {$prefix}.");
        }

        return $path;
    }

    /**
     * @return array<string, mixed>
     */
    private static function validRegistrationPayload(string $email): array
    {
        return [
            'name' => 'Parallel User',
            'email' => $email,
            'password' => 'correct-horse-battery-staple',
            'password_confirmation' => 'correct-horse-battery-staple',
            'kdf_salt' => base64_encode(str_repeat('s', 16)),
            'kdf_params' => [
                'version' => 1,
                'alg' => 'argon2id',
                'memlimit' => 67108864,
                'opslimit' => 3,
                'salt_len' => 16,
                'out_len' => 32,
            ],
            'public_key' => base64_encode(str_repeat('p', 32)),
            'private_key_ciphertext' => base64_encode(str_repeat('c', 80)),
            'private_key_nonce' => base64_encode(str_repeat('n', 24)),
            'device_name' => 'Race test',
        ];
    }
}
