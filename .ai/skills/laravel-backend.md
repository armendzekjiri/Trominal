# Skill: Laravel Backend

> Load this when working anywhere in `apps/backend/`.

## Version & setup

- **Laravel 13** (latest). Use `composer create-project laravel/laravel apps/backend "^13.0"` when scaffolding.
- **PHP 8.3+** required.
- **API + Filament admin panel** — Blade is enabled but only used for Filament. User-facing routes are API-only.

## Required packages

```
laravel/sanctum             # API auth
laravel/reverb              # WebSockets
laravel/horizon             # Queue monitoring
filament/filament           # Admin panel
spatie/laravel-permission   # Roles & permissions
pragmarx/google2fa-laravel  # TOTP 2FA
phpseclib/phpseclib         # Server-side SSH (web proxy)
larastan/larastan           # Static analysis (dev)
pestphp/pest                # Tests
```

## Directory conventions

```
apps/backend/
├── app/
│   ├── Filament/
│   │   ├── Resources/                # User, Role, Permission, Team, Invite resources
│   │   ├── Pages/                    # Settings, Audit Log, System Health
│   │   └── Widgets/                  # Dashboard widgets
│   ├── Http/
│   │   ├── Controllers/Api/V1/       # versioned API controllers
│   │   ├── Requests/                 # Form Requests
│   │   ├── Resources/                # API Resources (JSON serializers)
│   │   └── Middleware/
│   ├── Models/
│   ├── Policies/
│   ├── Providers/
│   │   └── Filament/AdminPanelProvider.php
│   ├── Services/
│   ├── Actions/
│   ├── Enums/                        # PHP 8.1 backed enums
│   └── Support/Crypto/               # server-side libsodium wrappers (validation only)
├── database/
│   ├── migrations/
│   └── seeders/
│       ├── RoleSeeder.php
│       └── PermissionSeeder.php
├── routes/
│   ├── api.php                       # mounts /api/v1 group
│   └── api_v1.php                    # actual v1 routes
├── tests/
│   ├── Feature/Api/V1/
│   ├── Feature/Filament/
│   └── Unit/
└── openapi.yaml                      # source of truth
```

## Roles & permissions (Spatie)

### Default roles seeded on install

```php
// database/seeders/RoleSeeder.php
$admin = Role::create(['name' => 'admin']);
$user  = Role::create(['name' => 'user']);
$guest = Role::create(['name' => 'guest']);

$admin->givePermissionTo(Permission::all());
$user->givePermissionTo([
    'hosts.create', 'hosts.read', 'hosts.update', 'hosts.delete', 'hosts.connect',
    'snippets.create', 'snippets.read', 'snippets.update', 'snippets.delete',
    'identities.create', 'identities.read', 'identities.update', 'identities.delete',
    'tunnels.create', 'tunnels.read', 'tunnels.update', 'tunnels.delete',
    'sftp.connect', 'sftp.read', 'sftp.upload', 'sftp.download', 'sftp.delete',
    'ai.use',
    'audit.read.own',
]);
$guest->givePermissionTo(['hosts.read', 'snippets.read']);
```

### First-user signup gets BOTH `admin` and `user` roles

The first user is a real user (uses the client app for SSH) AND an admin (uses Filament). Spatie supports multiple roles per user.

```php
// Inside the registration transaction:
$user->assignRole(['admin', 'user']);
```

### Checking permissions

In API controllers, use the `can` middleware:

```php
Route::post('/hosts', [HostController::class, 'store'])
    ->middleware(['auth:sanctum', 'can:hosts.create']);
```

Or in Policies:

```php
public function connect(User $user, Host $host): bool
{
    return $user->id === $host->user_id
        && $user->can('hosts.connect');
}
```

In Filament Resources, gate access:

```php
public static function canViewAny(): bool
{
    return auth()->user()?->hasRole('admin') ?? false;
}
```

### `/api/v1/me` returns roles + permissions

The client uses these to gate UI. Don't make the client request permissions separately.

```php
return [
    'id' => $user->id,
    'email' => $user->email,
    'roles' => $user->roles->pluck('name'),
    'permissions' => $user->getAllPermissions()->pluck('name'),
    // ... other fields
];
```

## Single-user mode race condition

The first registration must atomically:

1. Verify `app_settings.registration_open` is true
2. Verify no users exist (race-safety)
3. Create the user with `admin` + `user` roles
4. Set `app_settings.registration_open=false` (only in `single` mode)

Use `LOCK FOR UPDATE` on the settings row inside `DB::transaction()`. Test with parallel requests.

```php
public function register(RegisterRequest $request): UserResource
{
    return DB::transaction(function () use ($request) {
        $setting = AppSetting::where('key', 'registration_open')
            ->lockForUpdate()
            ->firstOrFail();

        if (!$setting->value) {
            throw new RegistrationClosedException();
        }

        $isFirstUser = User::count() === 0;
        $mode = config('trominal.registration_mode', 'single');

        $user = User::create([
            'email' => $request->validated('email'),
            'password' => Hash::make($request->validated('password')),
            'kdf_salt' => $request->validated('kdf_salt'),
            'kdf_params' => $request->validated('kdf_params'),
            'public_key' => $request->validated('public_key'),
            'private_key_ciphertext' => $request->validated('private_key_ciphertext'),
            'private_key_nonce' => $request->validated('private_key_nonce'),
        ]);

        if ($isFirstUser) {
            $user->assignRole(['admin', 'user']);
        } else {
            $user->assignRole('user');
        }

        if ($mode === 'single' && $isFirstUser) {
            $setting->update(['value' => false]);
        }

        AuditLog::record($user, 'user.registered', 'user', $user->id);

        return new UserResource($user);
    });
}
```

## Filament conventions

### Panel provider gates by `admin` role

```php
// app/Providers/Filament/AdminPanelProvider.php
public function panel(Panel $panel): Panel
{
    return $panel
        ->id('admin')
        ->path('admin')
        ->login()
        ->authMiddleware([
            Authenticate::class,
            VerifyTwoFactor::class,        // custom middleware
            EnsureUserHasRole::class . ':admin',
        ])
        ->resources([...])
        ->pages([...])
        ->widgets([...])
        ->colors(['primary' => Color::Indigo]);
}
```

### Filament Resource example

```php
// app/Filament/Resources/UserResource.php
final class UserResource extends Resource
{
    protected static ?string $model = User::class;
    protected static ?string $navigationIcon = 'heroicon-o-users';

    public static function canViewAny(): bool
    {
        return auth()->user()?->can('admin.users.manage') ?? false;
    }

    public static function form(Form $form): Form
    {
        return $form->schema([
            TextInput::make('email')->email()->required(),
            Select::make('roles')
                ->multiple()
                ->relationship('roles', 'name')
                ->preload(),
            Toggle::make('two_fa_enabled')->disabled(),  // user-controlled
            DateTimePicker::make('suspended_at'),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('email')->searchable(),
                TextColumn::make('roles.name')->badge(),
                IconColumn::make('two_fa_enabled')->boolean(),
                TextColumn::make('suspended_at')->dateTime(),
                TextColumn::make('created_at')->dateTime(),
            ])
            ->actions([
                EditAction::make(),
                Action::make('reset_password')
                    ->action(fn ($record) => $record->sendPasswordResetNotification(...)),
                Action::make('suspend')
                    ->action(fn ($record) => $record->update(['suspended_at' => now()]))
                    ->visible(fn ($record) => !$record->suspended_at),
            ]);
    }
}
```

### Filament actions write audit logs

Wrap any state-changing action with audit logging:

```php
Action::make('suspend')
    ->action(function ($record) {
        $record->update(['suspended_at' => now()]);
        AuditLog::record(auth()->user(), 'user.suspended', 'user', $record->id);
    })
```

### Filament Settings page (custom)

```php
// app/Filament/Pages/Settings.php
final class Settings extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-cog-6-tooth';
    protected static string $view = 'filament.pages.settings';

    public ?array $data = [];

    public function mount(): void
    {
        $this->form->fill([
            'instance_name' => AppSetting::value('instance_name'),
            'registration_mode' => AppSetting::value('registration_mode'),
            'registration_open' => AppSetting::value('registration_open'),
            'web_ssh_enabled' => AppSetting::value('web_ssh_enabled'),
        ]);
    }

    public function form(Form $form): Form
    {
        return $form->schema([
            TextInput::make('instance_name'),
            Select::make('registration_mode')->options([
                'single' => 'Single user',
                'open' => 'Open',
                'invite' => 'Invite only',
                'closed' => 'Closed',
            ]),
            Toggle::make('registration_open'),
            Toggle::make('web_ssh_enabled'),
        ])->statePath('data');
    }

    public function save(): void
    {
        foreach ($this->data as $key => $value) {
            AppSetting::set($key, $value);
        }
        AuditLog::record(auth()->user(), 'settings.updated', 'app_settings', null, $this->data);
        Notification::make()->success()->title('Settings saved')->send();
    }
}
```

## Models — strict types, casts, fillable allowlist

```php
final class User extends Authenticatable
{
    use HasApiTokens, HasUlids, HasRoles, Notifiable, TwoFactorAuthenticatable;

    protected $fillable = [
        'email', 'password', 'kdf_salt', 'kdf_params',
        'public_key', 'private_key_ciphertext', 'private_key_nonce',
        'two_fa_secret_enc', 'two_fa_enabled', 'vault_version',
    ];

    protected $hidden = [
        'password', 'two_fa_secret_enc',
        'private_key_ciphertext', 'private_key_nonce',
    ];

    protected $casts = [
        'kdf_params' => 'array',
        'two_fa_secret_enc' => 'encrypted',
        'private_key_ciphertext' => 'encrypted',
        'private_key_nonce' => 'encrypted',
        'two_fa_enabled' => 'boolean',
    ];

    public function hosts(): HasMany { return $this->hasMany(Host::class); }
    public function devices(): HasMany { return $this->hasMany(Device::class); }
}
```

## Form Requests — every POST/PUT

```php
final class StoreHostRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('hosts.create');
    }

    public function rules(): array
    {
        return [
            'label'    => ['required', 'string', 'max:120'],
            'address'  => ['required', 'string', 'max:255'],
            'port'     => ['required', 'integer', 'between:1,65535'],
            'username' => ['required', 'string', 'max:64'],
            'group_id' => ['nullable', 'ulid', 'exists:groups,id'],
            'team_id'  => ['nullable', 'ulid', 'exists:teams,id'],
            'tags'     => ['array'],
            'tags.*'   => ['string', 'max:32'],
        ];
    }
}
```

## Controllers — keep them thin

```php
final class HostController extends Controller
{
    public function __construct(private HostService $hosts) {}

    public function store(StoreHostRequest $request): HostResource
    {
        $host = $this->hosts->create(
            user: $request->user(),
            data: $request->validated(),
        );
        return new HostResource($host);
    }
}
```

## Policies — every authenticated resource

```php
final class HostPolicy
{
    public function view(User $user, Host $host): bool
    {
        return ($user->id === $host->user_id || $user->isInTeam($host->team_id))
            && $user->can('hosts.read');
    }

    public function connect(User $user, Host $host): bool
    {
        return ($user->id === $host->user_id || $user->isInTeam($host->team_id))
            && $user->can('hosts.connect');
    }
}
```

## Migrations

- ULIDs for primary keys: `$table->ulid('id')->primary();`
- Always `created_at`, `updated_at`, `deleted_at` (soft deletes).
- Encrypted columns: `text` type.
- Never edit a committed migration. Add a new one.

```php
Schema::create('users', function (Blueprint $table) {
    $table->ulid('id')->primary();
    $table->string('email')->unique();
    $table->string('password');
    $table->binary('kdf_salt');
    $table->json('kdf_params');
    $table->binary('public_key')->nullable();
    $table->text('private_key_ciphertext')->nullable();
    $table->binary('private_key_nonce')->nullable();
    $table->text('two_fa_secret_enc')->nullable();
    $table->boolean('two_fa_enabled')->default(false);
    $table->unsignedInteger('vault_version')->default(1);
    $table->timestamp('suspended_at')->nullable();
    $table->timestamps();
});
```

## Testing patterns

Cover both API and Filament:

```php
// API
it('forbids creating host without permission', function () {
    $user = User::factory()->create();
    $user->revokePermissionTo('hosts.create');

    $this->actingAs($user)->postJson('/api/v1/hosts', [...])
        ->assertForbidden();
});

// Filament
it('forbids non-admin from accessing user resource', function () {
    $user = User::factory()->create();
    $user->assignRole('user');

    $this->actingAs($user)
        ->get('/admin/users')
        ->assertForbidden();
});

it('admin can list users', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');

    $this->actingAs($admin)
        ->get('/admin/users')
        ->assertOk();
});
```

## What NOT to suggest

- ❌ Logic in controllers — move to services
- ❌ Validation in controllers — use Form Requests
- ❌ Raw SQL with user input — use Eloquent or parameterize
- ❌ Editing committed migrations — add a new one
- ❌ Exposing `password_hash`, `kdf_*`, `private_key_*`, soft-deleted records in API Resources
- ❌ Filament resources without role/permission gating in `canViewAny()`
- ❌ Admin actions without audit log entries
- ❌ Mixing Filament Blade routes with API routes — keep them in separate route files and middleware groups
