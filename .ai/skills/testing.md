# Skill: Testing

> Load this when writing tests, configuring CI, or fixing a flaky test.

## Coverage requirements

| Area                  | Threshold              | Tool                                         |
| --------------------- | ---------------------- | -------------------------------------------- |
| Backend               | ≥80% line              | Pest + Xdebug                                |
| Client TS             | ≥70% line              | Vitest + c8                                  |
| Rust                  | ≥60% line              | cargo-tarpaulin                              |
| Cross-platform crypto | 100% (golden fixtures) | both TS and Rust assert against fixture file |

CI fails if coverage drops below threshold.

## Backend tests (Pest)

### What to test

- **Every endpoint:** happy path + auth required + validation errors + ownership enforcement.
- **Every service method:** business logic branches.
- **Every policy:** allow + deny cases.
- **Single-user mode race condition** explicitly (parallel registration test).
- **Audit log** writes for sensitive actions.
- **Encrypted casts** round-trip.

### Structure

```
tests/
├── Feature/Api/V1/
│   ├── AuthTest.php
│   ├── HostsTest.php
│   ├── SnippetsTest.php
│   └── ...
├── Unit/
│   ├── Services/HostServiceTest.php
│   └── Policies/HostPolicyTest.php
└── Pest.php
```

### Patterns

```php
beforeEach(function () {
    $this->user = User::factory()->create();
});

it('rejects registration when closed in single mode', function () {
    AppSetting::where('key', 'registration_open')->update(['value' => false]);

    $this->postJson('/api/v1/auth/register', [
        'email' => 'x@y.z',
        'password' => 'correct horse battery staple',
        'kdf_salt' => str_repeat('a', 32),
        'kdf_params' => ['version' => 1, 'alg' => 'argon2id'],
    ])->assertForbidden();
});

it('atomically closes registration after first user in single mode', function () {
    config(['trominal.registration_mode' => 'single']);

    $this->postJson('/api/v1/auth/register', validRegistrationPayload())
        ->assertCreated();

    $this->postJson('/api/v1/auth/register', validRegistrationPayload(email: 'second@y.z'))
        ->assertForbidden();

    expect(User::first()->role)->toBe(Role::Admin);
});
```

### Single-user race-condition test

Use parallel HTTP requests to verify only one user is created:

```php
it('handles parallel first-user registrations atomically', function () {
    config(['trominal.registration_mode' => 'single']);

    $promises = collect(range(1, 5))->map(fn ($i) =>
        Http::async()->post(url('/api/v1/auth/register'), validRegistrationPayload(email: "p{$i}@y.z"))
    );

    $responses = Utils::settle($promises->all())->wait();

    $created = collect($responses)->filter(fn ($r) =>
        $r['state'] === 'fulfilled' && $r['value']->status() === 201
    );

    expect($created)->toHaveCount(1);
    expect(User::count())->toBe(1);
});
```

## Client tests (Vitest + Testing Library)

### What to test

- **Crypto module:** every function with a golden fixture; round-trips.
- **Stores:** state transitions (vault unlock/lock, auth refresh).
- **Hooks:** TanStack Query hooks with mocked api responses.
- **Components:** rendering + interaction for non-trivial logic.
- **Transport abstraction:** with mocked native + WS backends.

### Patterns

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVault } from '@/stores/vault'

describe('vault store', () => {
  beforeEach(() => useVault.getState().lock())

  it('unlocks with correct password', async () => {
    const { result } = renderHook(() => useVault())
    await act(async () => {
      await result.current.unlock('correct horse battery staple', mockSalt, mockParams)
    })
    expect(result.current.isLocked).toBe(false)
    expect(result.current.key).toBeInstanceOf(Uint8Array)
  })

  it('wipes key on lock', async () => {
    const { result } = renderHook(() => useVault())
    await act(async () => {
      await result.current.unlock('correct horse battery staple', mockSalt, mockParams)
    })
    const keyRef = result.current.key!
    act(() => result.current.lock())
    expect([...keyRef]).toEqual(new Array(32).fill(0))
  })
})
```

## Cross-platform crypto fixture

`packages/crypto/tests/fixtures/cross-platform.json`:

```json
[
  {
    "name": "trivial round-trip",
    "key_hex": "<32 bytes hex>",
    "nonce_hex": "<24 bytes hex>",
    "ad": "trominal:v1:test:1",
    "plaintext_hex": "<bytes>",
    "expected_ciphertext_hex": "<bytes>"
  }
]
```

Both TS test (Vitest) and Rust test (cargo test) load this same file and assert byte-equal output. CI runs both. If they diverge → release blocker.

## E2E tests (Playwright)

Cover critical user journeys end to end:

1. First-launch → connect to dev backend → register first user → set master password → see empty hosts list.
2. Login → unlock with master password → create host → list shows host → delete host.
3. Lock → unlock → state preserved correctly.
4. Change master password → re-login on second session → vault still works.

Mock the SSH layer in E2E (don't actually connect to a real server).

## What NOT to test

- Don't test framework code (TanStack Query internals, etc.).
- Don't test types (let TS do that).
- Don't test trivial getters/setters.
- Don't write tests that just mirror the implementation.

## Flaky test policy

- Flaky test = quarantined within 24h (`.skip` with TODO and issue link).
- Quarantined tests must be fixed within 1 sprint or deleted.
- No `--retry` to mask flakes. Find the root cause.

## CI matrix

```yaml
jobs:
  backend:
    runs-on: ubuntu-latest
    services: [postgres, redis]
    steps: [setup-php, composer install, pest, larastan]

  client:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    steps: [setup-node, pnpm install, vitest, eslint, tsc --noEmit]

  rust:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    steps: [cargo test, cargo clippy -- -D warnings, cargo fmt --check]

  crypto-parity:
    needs: [client, rust]
    steps: [run TS fixture test, run Rust fixture test, compare outputs]
```
