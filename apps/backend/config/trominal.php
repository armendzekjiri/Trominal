<?php

declare(strict_types=1);

return [
    'registration_mode' => env('TROMINAL_REGISTRATION_MODE', 'single'),
    'access_token_expiration_minutes' => (int) env('TROMINAL_ACCESS_TOKEN_EXPIRATION_MINUTES', 15),
    'refresh_token_expiration_days' => (int) env('TROMINAL_REFRESH_TOKEN_EXPIRATION_DAYS', 30),
];
