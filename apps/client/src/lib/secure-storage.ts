import { invoke } from '@tauri-apps/api/core'
import { isTauri } from './platform'

/**
 * Platform-agnostic secret store used for the refresh token and the persisted
 * server URL.
 *
 * - Desktop (Tauri): commands proxy to the OS keychain via the `keyring` crate.
 * - Web: `sessionStorage` for genuinely sensitive values (refresh token) so
 *   they're cleared on tab close, `localStorage` for non-secret values like
 *   the server URL. We do not pretend to encrypt at rest in the browser —
 *   there's no key to protect with.
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
    return await invoke<string | null>('secure_get', { key })
  },
  async set(key, value) {
    await invoke<void>('secure_set', { key, value })
  },
  async delete(key) {
    await invoke<void>('secure_delete', { key })
  },
}

const SESSION_KEYS: ReadonlyArray<SecureKey> = ['refresh_token']

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
