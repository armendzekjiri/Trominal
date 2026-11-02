import { create } from 'zustand'
import { deriveVaultKey, fromBase64, isKdfParams, type Envelope, wipe } from '@trominal/crypto'
import type { UserVaultMaterial } from '@trominal/api-client'
import { useTeamScope } from '@/features/teams/store'
import {
  openUserPrivateKey,
  sealUserPrivateKey,
  type PrivateKeyOwner,
} from '@/features/vault/private-key'
import { getApiClient } from '@/lib/api-client'
import { purgeDecryptedQueries } from '@/lib/query-client'

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
  /**
   * Cache the user's vault material returned by /me or registration. If the
   * KDF salt or parameters changed (master password rotated on another
   * device), the in-memory key is stale and the vault locks.
   */
  setMaterial: (material: UserVaultMaterial, vaultVersion?: number) => void
  /** Configure auto-lock duration (in ms). Pass 0 to disable. */
  setAutoLockMs: (ms: number) => void
  /**
   * Derive the vault key from the master password and verify it by decrypting
   * the user's private-key envelope (canary). Throws on wrong password.
   * A legacy email-bound envelope is re-bound to the user ID afterwards.
   */
  unlock: (masterPassword: string, owner: PrivateKeyOwner) => Promise<void>
  /**
   * Adopt a vault key derived during registration (when we already have the
   * key in hand and can avoid re-deriving from the password).
   */
  adoptKey: (key: Uint8Array) => void
  /**
   * Adopt the key and material produced by a successful master-password
   * rotation, wiping the previous key.
   */
  replaceKey: (key: Uint8Array, material: UserVaultMaterial, vaultVersion?: number) => void
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

/** True when the material would derive a different vault key. */
function keyMaterialChanged(previous: UserVaultMaterial | null, next: UserVaultMaterial): boolean {
  return (
    previous !== null &&
    (previous.kdf_salt !== next.kdf_salt ||
      JSON.stringify(previous.kdf_params) !== JSON.stringify(next.kdf_params))
  )
}

export const useVault = create<VaultStore>((set, get) => ({
  ...initial,

  setMaterial(material, vaultVersion) {
    const { material: previous, isLocked } = get()
    set({ material, vaultVersion: vaultVersion ?? material.vault_version ?? get().vaultVersion })
    if (!isLocked && keyMaterialChanged(previous, material)) {
      get().lock()
    }
  },

  setAutoLockMs(ms) {
    set({ autoLockMs: ms })
    if (!get().isLocked) {
      get().resetIdle()
    }
  },

  async unlock(masterPassword, owner) {
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
    // Validated (including resource bounds) before any derivation: the params
    // come from the server and must not be able to exhaust memory or CPU.
    if (!isKdfParams(material.kdf_params)) {
      throw new Error('Stored kdf_params are malformed or unsupported.')
    }
    const salt = await fromBase64(material.kdf_salt)
    let key: Uint8Array | null = null
    let canary: Uint8Array | null = null
    let rebound: Envelope | null = null

    try {
      key = await deriveVaultKey(masterPassword, salt, material.kdf_params)
      try {
        const opened = await openUserPrivateKey(material, key, owner)
        canary = opened.privateKey
        if (opened.legacy) {
          rebound = await sealUserPrivateKey(opened.privateKey, key, owner.id)
        }
      } catch (err) {
        throw new Error('Incorrect master password.', { cause: err })
      }

      const previous = get().key
      if (previous !== null && previous !== key) wipe(previous)
      set({ key, isLocked: false })
      key = null // now owned by the store; lock() wipes it
    } finally {
      // Best-effort zeroization of the decrypted canary and an unused key.
      if (canary !== null) wipe(canary)
      if (key !== null) wipe(key)
    }
    get().resetIdle()

    if (rebound !== null) {
      await rebindLegacyPrivateKey(rebound, material.vault_version ?? get().vaultVersion)
    }
  },

  adoptKey(key) {
    set({ key, isLocked: false })
    get().resetIdle()
  },

  replaceKey(key, material, vaultVersion) {
    const previous = get().key
    if (previous !== null && previous !== key) {
      wipe(previous)
    }
    set({
      key,
      isLocked: false,
      material,
      vaultVersion: vaultVersion ?? material.vault_version ?? get().vaultVersion,
    })
    get().resetIdle()
  },

  lock() {
    const { key, lockTimerId } = get()
    clearTimer(lockTimerId)
    if (key !== null) {
      wipe(key)
    }
    useTeamScope.getState().clearSelectedTeamKey()
    set({ key: null, isLocked: true, lockTimerId: null })
    // Cached query results are decrypted plaintext; they must not outlive the key.
    purgeDecryptedQueries()
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

/**
 * Upload a legacy (email-bound) private-key envelope re-encrypted under the
 * same vault key with the user-ID AD. Best effort: if it fails the account
 * keeps the legacy envelope and the next unlock tries again.
 */
async function rebindLegacyPrivateKey(envelope: Envelope, vaultVersion: number): Promise<void> {
  try {
    const api = await getApiClient()
    const response = await api.rebindPrivateKey({
      vault_version: vaultVersion,
      private_key_ciphertext: envelope.ct,
      private_key_nonce: envelope.n,
    })
    if (!useVault.getState().isLocked) {
      useVault.getState().setMaterial(response.vault, response.vault_version)
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('Could not re-bind the vault private key; retrying on next unlock.', err)
    }
  }
}
