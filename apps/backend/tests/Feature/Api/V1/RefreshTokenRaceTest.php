<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Models\RefreshToken;
use App\Services\AuthService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Tests\Concerns\InteractsWithAuthApi;
use Tests\TestCase;
use Throwable;

/**
 * Concurrent refreshes of the same token must never both succeed.
 *
 * Runs against a temporary SQLite file by default. When the suite is pointed
 * at PostgreSQL (DB_CONNECTION=pgsql), the workers race against that database
 * instead so real row locks are exercised.
 */
final class RefreshTokenRaceTest extends TestCase
{
    use InteractsWithAuthApi;

    private const WORKERS = 6;

    public function test_parallel_refreshes_of_one_token_allow_a_single_rotation(): void
    {
        if (! function_exists('pcntl_fork')) {
            self::markTestSkipped('The pcntl extension is required for the refresh race-condition test.');
        }

        $connection = (string) config('database.default');
        $usePostgres = $connection === 'pgsql';
        $database = $usePostgres ? null : $this->temporaryPath('trominal-refresh-race-db');
        $startFile = $this->temporaryPath('trominal-refresh-race-start');
        unlink($startFile);
        $resultFiles = [];
        $children = [];
        $originalSqliteConnection = config('database.connections.sqlite');

        try {
            $this->connect($database);

            Artisan::call('migrate:fresh', ['--force' => true]);
            $this->seed(RoleAndPermissionSeeder::class);

            $pair = app(AuthService::class)->register(self::registrationPayload('race@example.test'));
            $refreshToken = $pair['refresh_token'];

            DB::disconnect();

            foreach (range(1, self::WORKERS) as $worker) {
                $resultFile = $this->temporaryPath("trominal-refresh-race-result-{$worker}");
                $resultFiles[] = $resultFile;

                $pid = pcntl_fork();

                if ($pid === -1) {
                    self::fail('Unable to fork a refresh race-condition worker.');
                }

                if ($pid === 0) {
                    $this->runRefreshWorker($database, $startFile, $resultFile, $refreshToken);
                }

                $children[] = $pid;
            }

            touch($startFile);

            foreach ($children as $pid) {
                pcntl_waitpid($pid, $status);

                if (! pcntl_wifexited($status) || pcntl_wexitstatus($status) !== 0) {
                    self::fail("Refresh race-condition worker {$pid} exited unexpectedly.");
                }
            }

            $this->connect($database);

            $results = array_map(
                static fn (string $resultFile): string => trim((string) file_get_contents($resultFile)),
                $resultFiles,
            );
            $errors = array_values(array_filter($results, static fn (string $result): bool => str_starts_with($result, 'error:')));

            self::assertSame([], $errors, implode(PHP_EOL, $errors));
            self::assertSame(1, count(array_filter($results, static fn (string $result): bool => $result === 'rotated')));
            self::assertSame(self::WORKERS - 1, count(array_filter($results, static fn (string $result): bool => $result === 'rejected')));

            // One successor was minted; the reuse that lost the race revoked the whole family.
            self::assertSame(2, RefreshToken::query()->count());
            self::assertSame(0, RefreshToken::query()->whereNull('revoked_at')->count());
        } finally {
            if ($usePostgres) {
                Artisan::call('migrate:fresh', ['--force' => true]);
            }

            DB::purge();

            config(['database.connections.sqlite' => $originalSqliteConnection]);

            foreach ([$database, $startFile, ...$resultFiles] as $path) {
                if ($path !== null && file_exists($path)) {
                    unlink($path);
                }
            }
        }
    }

    private function runRefreshWorker(?string $database, string $startFile, string $resultFile, string $refreshToken): never
    {
        try {
            $this->waitForRaceStart($startFile);
            $this->connect($database);

            app(AuthService::class)->refresh(['refresh_token' => $refreshToken]);
            file_put_contents($resultFile, 'rotated');
        } catch (ValidationException) {
            file_put_contents($resultFile, 'rejected');
        } catch (Throwable $exception) {
            file_put_contents($resultFile, 'error: '.$exception::class.': '.$exception->getMessage());
        }

        exit(0);
    }

    private function waitForRaceStart(string $startFile): void
    {
        $deadline = microtime(true) + 5.0;

        while (! file_exists($startFile)) {
            if (microtime(true) >= $deadline) {
                throw new \RuntimeException('Timed out waiting for refresh race-condition start signal.');
            }

            usleep(1_000);
        }
    }

    private function connect(?string $database): void
    {
        DB::purge();

        if ($database === null) {
            return;
        }

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
}
