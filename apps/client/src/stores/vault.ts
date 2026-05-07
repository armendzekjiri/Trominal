import { create } from 'zustand'
import {
  decrypt,
  deriveVaultKey,
  fromBase64,
  isKdfParams,
  makeAd,
  type Envelope,
  type KdfParams,
  wipe,
} from '@trominal/crypto'
import type { UserVaultMaterial } from '@trominal/api-client'

const DEFAULT_AUTO_LOCK_MS = 15 * 60 * 1000

type VaultState = {
  /** Vault key in memory while unlocked, never persisted. Wiped on lock. */
  key: Uint8Array | null
  isLocked: boolean
  /** Vault material from the server — needed to re-derive the key on unlock. */
  material: UserVaultMaterial | null
  vaultVersion: number
  autoLockMs: number
  /** Internal: the active idle-lock timeout handle. */
  lockTimerId: ReturnType<typeof setTimeout> | null
}

type VaultActions = {
  /** Cache the user's vault material returned by /me or registration. */
  setMaterial: (material: UserVaultMaterial, vaultVersion?: number) => void
  /** Configure auto-lock duration (in ms). Pass 0 to disable. */
  setAutoLockMs: (ms: number) => void
  /**
   * Derive the vault key from the master password and verify it by decrypting
   * the user's private-key envelope (canary). Throws on wrong password.
   */
  unlock: (masterPassword: string, userEmail: string) => Promise<void>
  /**
   * Adopt a vault key derived during registration (when we already have the
   * key in hand and can avoid re-deriving from the password).
   */
  adoptKey: (key: Uint8Array) => void
  /** Wipe the key in place and lock the vault. */
  lock: () => void
  /** Reset the idle timer — call from a single document-level activity listener. */
  resetIdle: () => void
}

export type VaultStore = VaultState & VaultActions

const initial: VaultState = {
  key: null,
  isLocked: true,
  material: null,
  vaultVersion: 0,
  autoLockMs: DEFAULT_AUTO_LOCK_MS,
  lockTimerId: null,
}

function clearTimer(timerId: ReturnType<typeof setTimeout> | null): void {
  if (timerId !== null) {
    clearTimeout(timerId)
  }
}

export const useVault = create<VaultStore>((set, get) => ({
  ...initial,

  setMaterial(material, vaultVersion) {
    set({ material, vaultVersion: vaultVersion ?? get().vaultVersion })
  },

  setAutoLockMs(ms) {
    set({ autoLockMs: ms })
    if (!get().isLocked) {
      get().resetIdle()
    }
  },

  async unlock(masterPassword, userEmail) {
    const { material } = get()
    if (material === null) {
      throw new Error('Vault material not loaded; call setMaterial first.')
    }
    // Phase-2 placeholder: a since-removed Filament bootstrap page filled in
    // these columns with random bytes so an admin could be created before the
    // client existed. Such an account has no real master password — the user
    // has to delete it and re-register through the client.
    if (
      typeof material.kdf_params === 'object' &&
      material.kdf_params !== null &&
      (material.kdf_params as { alg?: string }).alg === 'temporary-filament-bootstrap'
    ) {
      throw new Error(
        'This account was bootstrapped from the admin panel and has no master password. ' +
          'Run `php artisan migrate:fresh --seed` and register through the client at /register.',
      )
    }
    if (!isKdfParams(material.kdf_params)) {
      throw new Error('Stored kdf_params are malformed.')
    }
    const params: KdfParams = material.kdf_params
    const salt = await fromBase64(material.kdf_salt)
    const key = await deriveVaultKey(masterPassword, salt, params)

    const canary: Envelope = {
      v: 1,
      ct: material.private_key_ciphertext,
      n: material.private_key_nonce,
    }
    try {
      await decrypt(canary, key, makeAd('user_private_key', userEmail))
    } catch (err) {
      wipe(key)
      throw new Error('Incorrect master password.', { cause: err })
    }

    set({ key, isLocked: false })
    get().resetIdle()
  },

  adoptKey(key) {
    set({ key, isLocked: false })
    get().resetIdle()
  },

  lock() {
    const { key, lockTimerId } = get()
    clearTimer(lockTimerId)
    if (key !== null) {
      wipe(key)
    }
    set({ key: null, isLocked: true, lockTimerId: null })
  },

  resetIdle() {
    const { lockTimerId, autoLockMs, isLocked } = get()
    clearTimer(lockTimerId)
    if (isLocked || autoLockMs <= 0) {
      set({ lockTimerId: null })
      return
    }
    const id = setTimeout(() => {
      get().lock()
    }, autoLockMs)
    set({ lockTimerId: id })
  },
}))
