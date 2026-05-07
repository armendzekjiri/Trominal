# Skill: Tauri + React Client

> Load this when working anywhere in `apps/client/`.

## Setup

- **Tauri 2** with React + TypeScript template.
- **Vite** as the dev server.
- **pnpm** as package manager.
- Web build is just the Vite output; desktop build wraps it in Tauri.

## Directory layout

```
apps/client/
├── src/                          # React (shared web + desktop)
│   ├── app/                      # router setup, providers
│   ├── features/                 # feature folders (hosts, snippets, terminal, ...)
│   │   └── hosts/
│   │       ├── api.ts            # TanStack Query hooks
│   │       ├── components/
│   │       ├── pages/
│   │       └── store.ts          # Zustand slice (if needed)
│   ├── lib/
│   │   ├── api-client.ts         # axios instance, auth interceptor
│   │   ├── transport.ts          # SSH transport factory
│   │   ├── platform.ts           # detect tauri vs web
│   │   └── crypto.ts             # re-export from packages/crypto
│   ├── components/ui/            # shadcn components
│   ├── stores/                   # global Zustand stores (vault, auth)
│   ├── styles/
│   ├── main.tsx
│   └── vite-env.d.ts
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── ssh/                  # russh wrapper
│   │   ├── secure_storage.rs
│   │   └── commands.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── public/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
└── tailwind.config.ts
```

## Platform detection

```typescript
// src/lib/platform.ts
export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export const platform = isTauri ? 'desktop' : 'web'
```

Use this to pick transports, secure storage backends, etc. Keep React components platform-agnostic — branch in the lib layer, not in JSX.

## State management

| State type         | Tool                                  | Example                   |
| ------------------ | ------------------------------------- | ------------------------- |
| Server data        | TanStack Query                        | hosts list, snippets list |
| Auth session       | Zustand (persist: refresh token only) | user, accessToken         |
| Vault key          | Zustand (NO persistence)              | vaultKey, isLocked        |
| UI ephemeral       | useState                              | open dialogs, form drafts |
| Cross-component UI | Zustand                               | sidebar collapsed, theme  |

```typescript
// stores/vault.ts
type VaultStore = {
  key: Uint8Array | null
  isLocked: boolean
  unlock: (password: string, salt: Uint8Array, params: KdfParams) => Promise<void>
  lock: () => void
}

export const useVault = create<VaultStore>((set, get) => ({
  key: null,
  isLocked: true,
  unlock: async (password, salt, params) => {
    const key = await deriveVaultKey(password, salt, params)
    set({ key, isLocked: false })
    scheduleAutoLock()
  },
  lock: () => {
    const { key } = get()
    if (key) key.fill(0) // wipe before drop
    set({ key: null, isLocked: true })
  },
}))
```

**Never** persist the vault key. Never put it in localStorage, IndexedDB, or Tauri storage.

## Auto-lock

- Idle timer reset on any user input event.
- Default 15 min. User-configurable in Settings.
- Hard-lock on window blur > 30 min (configurable).
- Lock = wipe key + redirect to unlock screen + close all open SSH sessions.

## API client

```typescript
// src/lib/api-client.ts
import axios from 'axios'
import { useAuth } from '@/stores/auth'

export const api = axios.create({
  baseURL: getApiBaseUrl(), // from config — set on first launch
})

api.interceptors.request.use((config) => {
  const { accessToken } = useAuth.getState()
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshed = await useAuth.getState().refresh()
      if (refreshed) return api.request(error.config)
      useAuth.getState().logout()
    }
    return Promise.reject(error)
  },
)
```

## TanStack Query patterns

```typescript
// features/hosts/api.ts
export const hostKeys = {
  all: ['hosts'] as const,
  list: () => [...hostKeys.all, 'list'] as const,
  detail: (id: string) => [...hostKeys.all, 'detail', id] as const,
}

export function useHosts() {
  return useQuery({
    queryKey: hostKeys.list(),
    queryFn: () => api.get('/api/v1/hosts').then((r) => r.data),
  })
}

export function useCreateHost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateHostInput) => api.post('/api/v1/hosts', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: hostKeys.list() }),
  })
}
```

## Forms

- **react-hook-form** + **zod** resolvers.
- Validation schema is the source of truth, types inferred from it.
- shadcn `<Form>` components for layout.

```typescript
const HostFormSchema = z.object({
  label: z.string().min(1).max(120),
  address: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1).max(64),
})
type HostFormValues = z.infer<typeof HostFormSchema>
```

## Styling

- **Tailwind CSS only.** No CSS-in-JS, no styled-components.
- **shadcn/ui** for primitives. Extend, don't replace.
- **CSS variables** for theme tokens (matching termcn.dev aesthetic).
- Dark mode default. Light mode via `class="dark"` on `<html>`.
- Font stack:
  - UI: system-ui
  - Mono (terminal + code): JetBrains Mono (bundled), fallback to monospace

## Tauri commands

```rust
// src-tauri/src/commands.rs
#[tauri::command]
pub async fn ssh_connect(
    state: State<'_, SshSessionManager>,
    host: String,
    port: u16,
    username: String,
    private_key_pem: Vec<u8>,    // Rust takes ownership; JS-side ref dropped by user
) -> Result<String, String> {
    let session_id = state.connect(host, port, username, &private_key_pem).await
        .map_err(|e| e.to_string())?;
    // private_key_pem is dropped here; if memory mattered, wrap in Zeroizing first
    Ok(session_id)
}
```

```typescript
// src/lib/native-ssh.ts
import { invoke } from '@tauri-apps/api/core'

export async function nativeSshConnect(args: NativeSshConnectArgs): Promise<string> {
  // After this call returns, do NOT keep args.privateKey around. Wipe + drop.
  try {
    return await invoke<string>('ssh_connect', args)
  } finally {
    args.privateKey.fill(0)
  }
}
```

## SSH transport

The React layer talks to a generic interface. The factory picks the right impl.

```typescript
// packages/ssh-transport/src/index.ts
export interface SshSession {
  connect(): Promise<void>
  write(data: Uint8Array): void
  resize(cols: number, rows: number): void
  close(): Promise<void>
  onData(cb: (chunk: Uint8Array) => void): () => void
  onClose(cb: (reason: string) => void): () => void
}

export function createSshSession(opts: SshConnectOptions): SshSession {
  return isTauri ? new NativeTransport(opts) : new WebSocketTransport(opts)
}
```

## Tests

- **Vitest** for unit tests (lib, stores, hooks via `@testing-library/react`).
- **Playwright** for E2E (signup → unlock → create host → connect, mocked SSH).
- Coverage threshold ≥70%.

## Performance

- Lazy-load feature routes via `React.lazy`.
- Virtualize lists > 100 items (`@tanstack/react-virtual`).
- Debounce search inputs (250ms).
- Memoize xterm.js writes (already buffered by xterm).

## Accessibility

- All interactive elements keyboard-accessible.
- shadcn primitives are a11y-correct by default — don't break them.
- Focus rings visible.
- Prefers-reduced-motion respected.
