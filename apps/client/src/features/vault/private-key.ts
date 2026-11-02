import { decrypt, encrypt, makeAd, type Envelope } from '@trominal/crypto'
import type { UserVaultMaterial } from '@trominal/api-client'

/** The account whose X25519 private key is wrapped by the vault key. */
export type PrivateKeyOwner = {
  id: string | number
  email: string
}

export type OpenedPrivateKey = {
  /** Secret X25519 private key. Caller owns it and must wipe it. */
  privateKey: Uint8Array
  /** True when the envelope still used the legacy email-bound AD. */
  legacy: boolean
}

/**
 * Associated data for the private-key envelope. Bound to the immutable user
 * ID so an email change (for example by an admin) cannot break unlock.
 */
export function userPrivateKeyAd(userId: string | number): string {
  return makeAd('user_private_key', String(userId))
}

/** Associated data used by accounts registered before the user-ID binding. */
export function legacyUserPrivateKeyAd(email: string): string {
  return makeAd('user_private_key', email)
}

/**
 * Decrypt the user's private-key envelope (also the vault unlock canary).
 *
 * Tries the user-ID AD first and falls back to the legacy email AD; `legacy`
 * tells the caller to re-bind the envelope. Throws if neither authenticates,
 * which means the key is wrong (or the envelope was tampered with).
 */
export async function openUserPrivateKey(
  material: Pick<UserVaultMaterial, 'private_key_ciphertext' | 'private_key_nonce'>,
  vaultKey: Uint8Array,
  owner: PrivateKeyOwner,
): Promise<OpenedPrivateKey> {
  const envelope: Envelope = {
    v: 1,
    ct: material.private_key_ciphertext,
    n: material.private_key_nonce,
  }
  try {
    return {
      privateKey: await decrypt(envelope, vaultKey, userPrivateKeyAd(owner.id)),
      legacy: false,
    }
  } catch (idError) {
    try {
      return {
        privateKey: await decrypt(envelope, vaultKey, legacyUserPrivateKeyAd(owner.email)),
        legacy: true,
      }
    } catch {
      throw idError
    }
  }
}

/** Encrypt the private key under `vaultKey`, bound to the user ID. */
export async function sealUserPrivateKey(
  privateKey: Uint8Array,
  vaultKey: Uint8Array,
  userId: string | number,
): Promise<Envelope> {
  return encrypt(privateKey, vaultKey, userPrivateKeyAd(userId))
}
