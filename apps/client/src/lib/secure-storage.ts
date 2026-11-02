import { invoke } from '@tauri-apps/api/core'
import { isTauri } from './platform'

/**
 * Platform-agnostic secret store used for the refresh token and the persisted
 * server URL.
 *
 * - Desktop (Tauri): production refresh tokens proxy to the OS keychain via
 *   the `keyring` crate. Dev builds use sessionStorage because macOS can
 *   repeatedly re-prompt unsigned/rebuilt dev binaries. The API base URL uses
 *   normal webview storage because it is not confidential and should not
 *   trigger a Keychain prompt at startup.
 * - Web: `sessionStorage` for genuinely sensitive values (refresh token) so
 *   they're cleared on tab close, `localStorage` for non-secret values like
 *   the server URL. We do not pretend to encrypt at rest in the browser —
 *   there's no key to protect with.
 *
 * Residual risk (web): sessionStorage is readable by any script running in
 * the page, so an XSS or a compromised bundled dependency can read the
 * refresh token. An httpOnly `Secure; SameSite=Strict` cookie would hide it
 * from JS, but the API rotates refresh tokens through the JSON body and the
 * web client may live on a different site than the API, where a Strict
 * cookie is never sent — so the cookie flow needs backend support first.
 * Until then the mitigations are: the strict CSP (no inline or eval'd
 * script), tab-scoped storage, single-use rotating refresh tokens
 * and wiping the token on logout. The vault key itself never
 * touches any storage.
 *
 * Keys must be one of `SECURE_KEYS` so we don't sprinkle string literals
 * across the codebase.
 */
export type SecureKey = 'refresh_token' | 'api_base_url'

export type SecureStorage = {
  get(key: SecureKey): Promise<string | null>
  set(key: SecureKey, value: string): Promise<void>
  delete(key: SecureKey): Promise<void>
}

const tauriBackend: SecureStorage = {
  async get(key) {
    if (usesWebStorageInTauri(key)) {
      return webStorageFor(key).getItem(`trominal:${key}`)
    }
    return await invoke<string | null>('secure_get', { key })
  },
  async set(key, value) {
    if (usesWebStorageInTauri(key)) {
      webStorageFor(key).setItem(`trominal:${key}`, value)
      return
    }
    await invoke<void>('secure_set', { key, value })
  },
  async delete(key) {
    if (usesWebStorageInTauri(key)) {
      webStorageFor(key).removeItem(`trominal:${key}`)
      return
    }
    await invoke<void>('secure_delete', { key })
  },
}

const SESSION_KEYS: ReadonlyArray<SecureKey> = ['refresh_token']

function usesWebStorageInTauri(key: SecureKey): boolean {
  if (key === 'api_base_url') return true
  // Dev-only convenience (see above). `import.meta.env.DEV` is statically
  // `false` in `vite build` output, so release desktop builds always keep the
  // refresh token in the OS keychain. Covered by secure-storage.test.ts.
  return import.meta.env.DEV === true
}

function webStorageFor(key: SecureKey): Storage {
  // sessionStorage clears on tab close — right place for the refresh token on
  // the web. localStorage is fine for the API base URL because the URL itself
  // isn't a secret.
  return SESSION_KEYS.includes(key) ? window.sessionStorage : window.localStorage
}

const webBackend: SecureStorage = {
  async get(key) {
    return webStorageFor(key).getItem(`trominal:${key}`)
  },
  async set(key, value) {
    webStorageFor(key).setItem(`trominal:${key}`, value)
  },
  async delete(key) {
    webStorageFor(key).removeItem(`trominal:${key}`)
  },
}

/** The active secure-storage backend for the current runtime. */
export const secureStorage: SecureStorage = isTauri ? tauriBackend : webBackend
