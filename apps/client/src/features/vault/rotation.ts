import {
  DEFAULT_KDF_PARAMS,
  decrypt,
  deriveVaultKey,
  encrypt,
  fromBase64,
  generateSalt,
  isKdfParams,
  toBase64,
  wipe,
  type KdfParams,
} from '@trominal/crypto'
import type {
  MasterPasswordChangeItem,
  MasterPasswordChangeRequest,
  MasterPasswordChangeResponse,
  UserVaultMaterial,
  VaultRecord,
  VaultResourceType,
} from '@trominal/api-client'
import { personalRecordAd } from './model'
import { openUserPrivateKey, sealUserPrivateKey, type PrivateKeyOwner } from './private-key'

/** Every vault collection; the server requires all personal records of all of them. */
export const ROTATED_RESOURCE_TYPES: ReadonlyArray<VaultResourceType> = [
  'groups',
  'hosts',
  'host-credentials',
  'snippets',
  'identities',
  'tunnels',
  'ai-settings',
]

/** The subset of the API client the rotation needs (injectable for tests). */
export type RotationApi = {
  listVaultRecords: (type: VaultResourceType) => Promise<VaultRecord[]>
  changeMasterPassword: (
    payload: MasterPasswordChangeRequest,
  ) => Promise<MasterPasswordChangeResponse>
}

export type RotateMasterPasswordInput = {
  api: RotationApi
  owner: PrivateKeyOwner
  /** Current vault material (salt, params, private-key envelope). */
  material: UserVaultMaterial
  /** The vault_version the client currently holds. */
  vaultVersion: number
  currentMasterPassword: string
  newMasterPassword: string
  /** Login password for server-side step-up. */
  currentPassword: string
  /** Current TOTP code when two-factor authentication is enabled. */
  twoFactorCode?: string
  /** This device's refresh token; the only session the server keeps. */
  refreshToken: string
  params?: KdfParams
}

export type RotationResult = {
  /** New vault key. Caller owns it (adopt it or wipe it). */
  key: Uint8Array
  material: UserVaultMaterial
  vaultVersion: number
  itemCount: number
}

/**
 * Change the master password: derive the current key from the current
 * password (verified against the private-key canary), derive a new key from
 * a fresh salt, re-encrypt the private key and every encrypted column of
 * every personal vault record, and submit it all as one versioned request.
 *
 * The server applies it atomically or not at all. On any failure the new key
 * is wiped and the caller's existing key stays valid. Plaintext buffers are
 * wiped as soon as they are re-encrypted (best effort: JS strings and engine
 * copies cannot be erased).
 */
export async function rotateMasterPassword(
  input: RotateMasterPasswordInput,
): Promise<RotationResult> {
  const params = input.params ?? DEFAULT_KDF_PARAMS
  if (!isKdfParams(input.material.kdf_params) || !isKdfParams(params)) {
    throw new Error('Unsupported KDF parameters.')
  }

  let currentKey: Uint8Array | null = null
  let newKey: Uint8Array | null = null
  let privateKey: Uint8Array | null = null

  try {
    currentKey = await deriveVaultKey(
      input.currentMasterPassword,
      await fromBase64(input.material.kdf_salt),
      input.material.kdf_params,
    )
    try {
      privateKey = (await openUserPrivateKey(input.material, currentKey, input.owner)).privateKey
    } catch (err) {
      throw new Error('Incorrect master password.', { cause: err })
    }

    const newSalt = await generateSalt(params.salt_len)
    newKey = await deriveVaultKey(input.newMasterPassword, newSalt, params)

    const items: MasterPasswordChangeItem[] = []
    for (const type of ROTATED_RESOURCE_TYPES) {
      for (const record of await input.api.listVaultRecords(type)) {
        items.push(await reEncryptRecord(type, record, currentKey, newKey))
      }
    }

    const canary = await sealUserPrivateKey(privateKey, newKey, input.owner.id)
    const response = await input.api.changeMasterPassword({
      vault_version: input.vaultVersion,
      current_password: input.currentPassword,
      ...(input.twoFactorCode ? { two_factor_code: input.twoFactorCode } : {}),
      current_refresh_token: input.refreshToken,
      new_kdf_salt: await toBase64(newSalt),
      new_kdf_params: params,
      private_key_ciphertext: canary.ct,
      private_key_nonce: canary.n,
      items,
    })

    const result: RotationResult = {
      key: newKey,
      material: response.vault,
      vaultVersion: response.vault_version,
      itemCount: items.length,
    }
    newKey = null // ownership moves to the caller
    return result
  } finally {
    if (privateKey !== null) wipe(privateKey)
    if (currentKey !== null) wipe(currentKey)
    if (newKey !== null) wipe(newKey)
  }
}

/**
 * Re-encrypt every non-null `<field>_ciphertext` / `<field>_nonce` pair of a
 * personal record under `newKey`, keeping the record's associated data.
 * Works on raw bytes so no field is lost or reformatted.
 */
export async function reEncryptRecord(
  type: VaultResourceType,
  record: VaultRecord,
  currentKey: Uint8Array,
  newKey: Uint8Array,
): Promise<MasterPasswordChangeItem> {
  if (record.team_id !== null && record.team_id !== undefined && record.team_id !== '') {
    throw new Error('Team vault records are not part of a master-password rotation.')
  }

  const ad = personalRecordAd(type, record.id)
  const fields: Record<string, string> = {}

  for (const [column, ciphertext] of Object.entries(record)) {
    if (!column.endsWith('_ciphertext') || typeof ciphertext !== 'string' || ciphertext === '') {
      continue
    }
    const base = column.slice(0, -'_ciphertext'.length)
    const nonce = record[`${base}_nonce`]
    if (typeof nonce !== 'string' || nonce === '') {
      throw new Error(`Vault record ${record.id} has a ciphertext without a nonce.`)
    }

    const plaintext = await decrypt({ v: 1, ct: ciphertext, n: nonce }, currentKey, ad)
    try {
      const envelope = await encrypt(plaintext, newKey, ad)
      fields[`${base}_ciphertext`] = envelope.ct
      fields[`${base}_nonce`] = envelope.n
    } finally {
      wipe(plaintext)
    }
  }

  return { type, id: record.id, updated_at: record.updated_at, fields }
}
