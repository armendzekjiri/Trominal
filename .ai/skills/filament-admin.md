# Skill: Filament Admin Panel

> Load this when working in `apps/backend/app/Filament/`, on admin panel pages, resources, or widgets.

## Mental model

The Filament panel is the **operator's control room**. It's separate from the client app:

- **Client app** = end-user experience for SSH/dev work. Cannot manage other users, instance settings, or roles.
- **Filament panel** = operator's panel. Manages users, teams, roles, permissions, instance settings, audit log.

The first registered user has BOTH `admin` and `user` roles, so they can use both surfaces. Subsequent users created by the admin typically have only `user` (or `guest`).

URL: `/admin` on the Laravel host.

## Mandatory authorization

Every Filament resource and page **must** gate by role/permission. Forgetting this is a critical security bug.

```php
public static function canViewAny(): bool
{
    return auth()->user()?->can('admin.users.manage') ?? false;
}
```

For Filament Pages:

```php
public static function shouldRegisterNavigation(): bool
{
    return auth()->user()?->hasRole('admin') ?? false;
}

public static function canAccess(): bool
{
    return auth()->user()?->hasRole('admin') ?? false;
}
```

The panel provider also enforces `admin` role globally:

```php
->authMiddleware([
    Authenticate::class,
    EnsureUserHasRole::class . ':admin',
])
```

So defense in depth: panel-level guard + resource-level guard + Policy.

## Required Resources for v0.1

| Resource             | What it does                                                                     |
| -------------------- | -------------------------------------------------------------------------------- |
| `UserResource`       | List/create/edit/suspend users. Assign roles. Trigger password reset emails.     |
| `RoleResource`       | CRUD roles. Assign permissions. (Spatie integration.)                            |
| `PermissionResource` | Read-only list of permissions. (Permissions are seeded, not created at runtime.) |
| `InviteResource`     | Generate/revoke invite codes (only when `registration_mode=invite`).             |
| `TeamResource`       | Phase 8 — list/create/edit teams, view membership.                               |
| `AuditLogResource`   | Read-only, filterable, searchable audit log.                                     |

## Required Pages

| Page           | What it does                                                                  |
| -------------- | ----------------------------------------------------------------------------- |
| `Settings`     | Toggle registration mode, instance name, feature flags (web SSH, AI proxy).   |
| `SystemHealth` | Show queue status (link to Horizon), Redis status, DB version, Reverb status. |

## Required Widgets

| Widget                      | What it shows                                                             |
| --------------------------- | ------------------------------------------------------------------------- |
| `StatsOverviewWidget`       | Total users, active sessions, registrations this week, audit events today |
| `RecentRegistrationsWidget` | Latest 10 user registrations                                              |
| `RecentAuditWidget`         | Latest 20 audit log entries                                               |

## Audit logging — REQUIRED on every admin action

Every Filament action that modifies state must write an audit log entry. This is non-negotiable.

```php
Action::make('suspend')
    ->requiresConfirmation()
    ->action(function (User $record) {
        DB::transaction(function () use ($record) {
            $record->update(['suspended_at' => now()]);
            $record->tokens()->delete();             // revoke all sessions
            AuditLog::record(
                actor: auth()->user(),
                action: 'admin.user.suspended',
                resourceType: 'user',
                resourceId: $record->id,
            );
        });
        Notification::make()->success()->title('User suspended')->send();
    })
```

## Settings persistence pattern

Settings are stored in the `app_settings` table as key-value pairs. Use a small helper:

```php
// app/Models/AppSetting.php
final class AppSetting extends Model
{
    protected $fillable = ['key', 'value'];
    protected $casts = ['value' => 'json'];

    public static function value(string $key, mixed $default = null): mixed
    {
        return Cache::rememberForever("setting:{$key}", function () use ($key, $default) {
            return self::where('key', $key)->value('value') ?? $default;
        });
    }

    public static function set(string $key, mixed $value): void
    {
        self::updateOrCreate(['key' => $key], ['value' => $value]);
        Cache::forget("setting:{$key}");
    }
}
```

The Filament Settings page reads/writes through this helper.

## Filament 2FA enforcement

Admin panel access requires 2FA. If the user has `two_fa_enabled=false`, redirect them to a "set up 2FA" page before letting them into the admin area.

```php
// app/Http/Middleware/RequireTwoFactorForAdmin.php
public function handle(Request $request, Closure $next): Response
{
    $user = $request->user();
    if ($user && !$user->two_fa_enabled) {
        return redirect()->route('admin.two-fa.setup');
    }
    return $next($request);
}
```

Wire into `AdminPanelProvider::authMiddleware`.

## Forms — Filament form schema

```php
public static function form(Form $form): Form
{
    return $form->schema([
        Section::make('Account')
            ->schema([
                TextInput::make('email')->email()->required()->unique(ignoreRecord: true),
                TextInput::make('password')
                    ->password()
                    ->dehydrateStateUsing(fn ($state) => Hash::make($state))
                    ->dehydrated(fn ($state) => filled($state))
                    ->required(fn (string $context) => $context === 'create'),
            ])->columns(2),

        Section::make('Roles')
            ->schema([
                Select::make('roles')
                    ->multiple()
                    ->relationship('roles', 'name')
                    ->preload()
                    ->required(),
            ]),

        Section::make('Status')
            ->schema([
                DateTimePicker::make('suspended_at')
                    ->label('Suspended at')
                    ->helperText('Set to suspend this user from logging in'),
            ]),
    ]);
}
```

## Tables — Filament table

```php
public static function table(Table $table): Table
{
    return $table
        ->columns([
            TextColumn::make('email')->searchable()->sortable(),
            TextColumn::make('roles.name')->badge()->color('primary'),
            IconColumn::make('two_fa_enabled')->boolean()->label('2FA'),
            TextColumn::make('last_login_at')->dateTime()->sortable(),
            TextColumn::make('suspended_at')->dateTime()->placeholder('Active'),
            TextColumn::make('created_at')->dateTime()->sortable(),
        ])
        ->filters([
            TernaryFilter::make('suspended')
                ->nullable()
                ->placeholder('All users')
                ->trueLabel('Only suspended')
                ->falseLabel('Only active')
                ->queries(
                    true: fn ($q) => $q->whereNotNull('suspended_at'),
                    false: fn ($q) => $q->whereNull('suspended_at'),
                ),
            SelectFilter::make('roles')->relationship('roles', 'name'),
        ])
        ->actions([
            EditAction::make(),
            Action::make('reset_password')
                ->icon('heroicon-o-key')
                ->action(fn ($record) => $record->sendPasswordResetNotification(...)),
            Action::make('suspend')
                ->icon('heroicon-o-no-symbol')
                ->color('danger')
                ->requiresConfirmation()
                ->action(/* see audit example above */)
                ->visible(fn ($record) => is_null($record->suspended_at)),
        ])
        ->bulkActions([]);
}
```

## What admin panel does NOT do

- ❌ It does not show plaintext vault items (server can't decrypt them).
- ❌ It does not start SSH sessions.
- ❌ It does not show terminal session content (never logged).
- ❌ It does not bypass 2FA.
- ❌ It does not allow self-modification of an admin's own role (prevent foot-gun where the only admin demotes themselves).

## Self-foot-gun prevention

```php
public static function canDelete(Model $record): bool
{
    if (!auth()->user()->hasRole('admin')) return false;

    // Don't delete yourself
    if ($record->id === auth()->id()) return false;

    // Don't delete the last admin
    if ($record->hasRole('admin') && User::role('admin')->count() <= 1) return false;

    return true;
}
```

Same pattern for role/permission removal.

## Testing Filament

```php
use Filament\Facades\Filament;

it('admin can list users', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');

    $this->actingAs($admin)
        ->get(UserResource::getUrl('index'))
        ->assertOk();
});

it('non-admin gets 403 from admin panel', function () {
    $user = User::factory()->create();
    $user->assignRole('user');

    $this->actingAs($user)
        ->get('/admin')
        ->assertForbidden();
});

it('cannot delete the last admin', function () {
    $admin = User::factory()->create();
    $admin->assignRole('admin');
    $other = User::factory()->create();
    $other->assignRole('admin');

    $this->actingAs($admin);
    expect(UserResource::canDelete($admin))->toBeFalse();    // self
    expect(UserResource::canDelete($other))->toBeTrue();

    $other->removeRole('admin');                              // now $admin is the only one
    expect(UserResource::canDelete($admin))->toBeFalse();
});
```

## What NOT to do

- ❌ Don't expose Filament resources without `canViewAny()` gating
- ❌ Don't skip audit log entries on admin actions
- ❌ Don't put business logic in Filament Resources — call Services
- ❌ Don't let admins decrypt user vaults (the server can't anyway, but don't add backdoors trying)
- ❌ Don't show plaintext anything sensitive in Filament tables — even password hashes, 2FA secrets, refresh tokens
- ❌ Don't merge Filament Blade routes with API routes
