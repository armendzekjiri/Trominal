<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Mail\Transport\ArrayTransport;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\Concerns\InteractsWithAuthApi;
use Tests\TestCase;

final class PasswordResetLinkTest extends TestCase
{
    use InteractsWithAuthApi;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
        config(['trominal.client_url' => 'https://app.trominal.test/']);
    }

    public function test_the_reset_link_points_at_the_client_reset_page(): void
    {
        Notification::fake();
        $this->registerUser()->assertCreated();
        /** @var User $user */
        $user = User::query()->firstOrFail();

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'first@example.test'])->assertAccepted();

        $url = null;
        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $notification) use ($user, &$url): bool {
            $url = self::actionUrl($notification, $user);

            return $url === 'https://app.trominal.test/reset-password?'.http_build_query([
                'token' => $notification->token,
                'email' => 'first@example.test',
            ]);
        });

        // The token and email in the link are exactly what the client's reset page submits.
        parse_str((string) parse_url((string) $url, PHP_URL_QUERY), $query);
        $this->postJson('/api/v1/auth/reset-password', [
            'email' => $query['email'] ?? null,
            'token' => $query['token'] ?? null,
            'password' => 'brand-new-login-password',
            'password_confirmation' => 'brand-new-login-password',
        ])->assertOk();
    }

    public function test_the_reset_email_is_actually_delivered(): void
    {
        config(['mail.default' => 'array']);
        $this->registerUser()->assertCreated();

        // Same call the admin panel's "Reset password" action makes.
        $status = Password::sendResetLink(['email' => 'first@example.test']);
        self::assertSame(Password::RESET_LINK_SENT, $status);

        $transport = Mail::mailer('array')->getSymfonyTransport();
        self::assertInstanceOf(ArrayTransport::class, $transport);
        $messages = $transport->messages();
        self::assertCount(1, $messages);
        self::assertStringContainsString(
            'https://app.trominal.test/reset-password?token=',
            quoted_printable_decode($messages->first()->toString()),
        );
    }

    public function test_the_response_does_not_reveal_whether_the_account_exists(): void
    {
        Notification::fake();
        $this->registerUser()->assertCreated();

        $known = $this->postJson('/api/v1/auth/forgot-password', ['email' => 'first@example.test'])->assertAccepted();
        $unknown = $this->postJson('/api/v1/auth/forgot-password', ['email' => 'nobody@example.test'])->assertAccepted();
        $repeat = $this->postJson('/api/v1/auth/forgot-password', ['email' => 'first@example.test'])->assertAccepted();

        self::assertSame($known->json(), $unknown->json());
        self::assertSame($known->json(), $repeat->json());
        Notification::assertSentTimes(ResetPassword::class, 1);
    }

    public function test_resetting_with_an_unknown_email_looks_like_a_bad_token(): void
    {
        $this->registerUser()->assertCreated();
        $payload = [
            'token' => str_repeat('f', 64),
            'password' => 'brand-new-login-password',
            'password_confirmation' => 'brand-new-login-password',
        ];

        $known = $this->postJson('/api/v1/auth/reset-password', [...$payload, 'email' => 'first@example.test'])
            ->assertUnprocessable();
        $unknown = $this->postJson('/api/v1/auth/reset-password', [...$payload, 'email' => 'nobody@example.test'])
            ->assertUnprocessable();

        self::assertSame($known->json(), $unknown->json());
    }

    public function test_a_delivery_failure_does_not_reveal_that_the_account_exists(): void
    {
        $this->registerUser()->assertCreated();
        config([
            'mail.default' => 'smtp',
            'mail.mailers.smtp.host' => '127.0.0.1',
            'mail.mailers.smtp.port' => 1,
            'mail.mailers.smtp.timeout' => 1,
        ]);

        $known = $this->postJson('/api/v1/auth/forgot-password', ['email' => 'first@example.test'])->assertAccepted();
        $unknown = $this->postJson('/api/v1/auth/forgot-password', ['email' => 'nobody@example.test'])->assertAccepted();

        self::assertSame($known->json(), $unknown->json());
    }

    public function test_the_client_url_defaults_to_the_app_url(): void
    {
        Notification::fake();
        config(['trominal.client_url' => null, 'app.url' => 'https://trominal.example.test']);
        $this->registerUser()->assertCreated();
        /** @var User $user */
        $user = User::query()->firstOrFail();

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'first@example.test'])->assertAccepted();

        Notification::assertSentTo($user, ResetPassword::class, fn (ResetPassword $notification): bool => str_starts_with(
            self::actionUrl($notification, $user),
            'https://trominal.example.test/reset-password?token=',
        ));
    }

    private static function actionUrl(ResetPassword $notification, User $user): string
    {
        $mail = $notification->toMail($user);
        self::assertInstanceOf(MailMessage::class, $mail);

        return (string) $mail->actionUrl;
    }
}
