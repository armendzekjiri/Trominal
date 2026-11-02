<?php

declare(strict_types=1);

namespace App\Exceptions;

use RuntimeException;

/**
 * Raised when an admin-panel change would lock every administrator out of
 * the instance (no usable admin left, admin role stripped or renamed).
 */
final class AdminLockoutException extends RuntimeException {}
