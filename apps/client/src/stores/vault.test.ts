import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_KDF_PARAMS,
  decrypt,
  deriveVaultKey,
  encrypt,
  generateSalt,
  generateX25519KeyPair,
  makeAd,
  toBase64,
  type KdfParams,
} from '@trominal/crypto'
import type { PrivateKeyRebindRequest, UserVaultMaterial } from '@trominal/api-client'
import { useTeamScope } from '@/features/teams/store'
import { useVault } from './vault'

const rebindPrivateKey = vi.fn()

vi.mock('@/lib/api-client', () => ({
  getApiClient: async () => ({ rebindPrivateKey }),
}))

const OWNER = { id: '01jbz8w0q9x3t7k2m4n6p8r0s2', email: 'unlock-test@example.com' }
const TEST_MASTER_PW = 'correct horse battery staple 1!'

async function makeMaterial(
  ad: string = makeAd('user_private_key', OWNER.id),
  params: KdfParams = DEFAULT_KDF_PARAMS,
): Promise<{ material: UserVaultMaterial; key: Uint8Array; privateKey: Uint8Array }> {
  const salt = await generateSalt(16)
  const key = await deriveVaultKey(TEST_MASTER_PW, salt, { ...DEFAULT_KDF_PARAMS })
  const kp = await generateX25519KeyPair()
  const env = await encrypt(kp.privateKey, key, ad)
  return {
    key,
    privateKey: new Uint8Array(kp.privateKey),
    material: {
      kdf_salt: await toBase64(salt),
      kdf_params: params,
      public_key: await toBase64(kp.publicKey),
      private_key_ciphertext: env.ct,
      private_key_nonce: env.n,
      vault_version: 1,
      private_key_ad_version: ad.endsWith(OWNER.id) ? 2 : 1,
    },
  }
}

beforeEach(() => {
  useVault.getState().lock()
  useTeamScope.getState().setPersonalScope()
  rebindPrivateKey.mockReset()
})

afterEach(() => {
  useVault.getState().lock()
  useTeamScope.getState().setPersonalScope()
})

describe('vault store', () => {
  it('unlocks with the right master password and exposes the key', async () => {
    const { material } = await makeMaterial()
    useVault.getState().setMaterial(material)
    await useVault.getState().unlock(TEST_MASTER_PW, OWNER)
    const state = useVault.getState()
    expect(state.isLocked).toBe(false)
    expect(state.key).not.toBeNull()
    expect(state.key?.length).toBe(32)
    expect(state.vaultVersion).toBe(1)
    expect(rebindPrivateKey).not.toHaveBeenCalled()
  }, 30_000)

  it('refuses the wrong master password and stays locked', async () => {
    const { material } = await makeMaterial()
    useVault.getState().setMaterial(material)
    await expect(useVault.getState().unlock('wrong-password', OWNER)).rejects.toThrow(
      /Incorrect master password/,
    )
    expect(useVault.getState().isLocked).toBe(true)
    expect(useVault.getState().key).toBeNull()
  }, 30_000)

  it('keeps unlocking after the email address changes (AD is bound to the user ID)', async () => {
    const { material } = await makeMaterial()
    useVault.getState().setMaterial(material)
    await useVault.getState().unlock(TEST_MASTER_PW, { ...OWNER, email: 'renamed@example.com' })
    expect(useVault.getState().isLocked).toBe(false)
  }, 30_000)

  it('rejects out-of-bounds KDF parameters before deriving', async () => {
    const { material } = await makeMaterial(undefined, {
      ...DEFAULT_KDF_PARAMS,
      memlimit: 4 * 1024 * 1024 * 1024,
    })
    useVault.getState().setMaterial(material)
    await expect(useVault.getState().unlock(TEST_MASTER_PW, OWNER)).rejects.toThrow(/kdf_params/i)
    expect(useVault.getState().isLocked).toBe(true)
  })

  it('migrates a legacy email-bound envelope to the user ID on unlock', async () => {
    const { material, key, privateKey } = await makeMaterial(
      makeAd('user_private_key', OWNER.email),
    )
    rebindPrivateKey.mockImplementation(async (payload: PrivateKeyRebindRequest) => ({
      vault_version: 2,
      vault: {
        ...material,
        private_key_ciphertext: payload.private_key_ciphertext,
        private_key_nonce: payload.private_key_nonce,
        vault_version: 2,
        private_key_ad_version: 2,
      },
    }))
    useVault.getState().setMaterial(material)

    await useVault.getState().unlock(TEST_MASTER_PW, OWNER)

    expect(useVault.getState().isLocked).toBe(false)
    expect(rebindPrivateKey).toHaveBeenCalledTimes(1)
    const payload = rebindPrivateKey.mock.calls[0][0] as PrivateKeyRebindRequest
    expect(payload.vault_version).toBe(1)
    const reopened = await decrypt(
      { v: 1, ct: payload.private_key_ciphertext, n: payload.private_key_nonce },
      key,
      makeAd('user_private_key', OWNER.id),
    )
    expect(Array.from(reopened)).toEqual(Array.from(privateKey))
    expect(useVault.getState().material?.private_key_ad_version).toBe(2)
    expect(useVault.getState().vaultVersion).toBe(2)

    // After migration an email change no longer matters.
    useVault.getState().lock()
    await useVault.getState().unlock(TEST_MASTER_PW, { ...OWNER, email: 'renamed@example.com' })
    expect(useVault.getState().isLocked).toBe(false)
    expect(rebindPrivateKey).toHaveBeenCalledTimes(1)
  }, 30_000)

  it('stays unlocked when the legacy migration upload fails', async () => {
    const { material } = await makeMaterial(makeAd('user_private_key', OWNER.email))
    rebindPrivateKey.mockRejectedValue(new Error('offline'))
    useVault.getState().setMaterial(material)

    await useVault.getState().unlock(TEST_MASTER_PW, OWNER)

    expect(useVault.getState().isLocked).toBe(false)
    expect(useVault.getState().material?.private_key_ad_version).toBe(1)
  }, 30_000)

  it('lock() wipes the key bytes in place before dropping the reference', async () => {
    const { material } = await makeMaterial()
    useVault.getState().setMaterial(material)
    await useVault.getState().unlock(TEST_MASTER_PW, OWNER)
    const keyBuffer = useVault.getState().key
    expect(keyBuffer).not.toBeNull()
    if (keyBuffer === null) return
    // Hold a reference, lock, and assert the underlying buffer is zeroed.
    useVault.getState().lock()
    expect(Array.from(keyBuffer).every((byte) => byte === 0)).toBe(true)
    expect(useVault.getState().key).toBeNull()
    expect(useVault.getState().isLocked).toBe(true)
  }, 30_000)

  it('lock() wipes the selected team key', () => {
    const vaultKey = new Uint8Array(32).fill(5)
    const teamKey = new Uint8Array(32).fill(6)

    useVault.getState().adoptKey(vaultKey)
    useTeamScope.getState().setTeamScope('team_01')
    useTeamScope.getState().setSelectedTeamKey('team_01', 1, teamKey)
    useVault.getState().lock()

    expect(useTeamScope.getState().selectedTeamKey).toBeNull()
    expect(Array.from(teamKey).every((byte) => byte === 0)).toBe(true)
  })

  it('adoptKey unlocks without re-deriving (used immediately after register)', async () => {
    const { material, key } = await makeMaterial()
    useVault.getState().setMaterial(material)
    useVault.getState().adoptKey(key)
    expect(useVault.getState().isLocked).toBe(false)
    expect(useVault.getState().key).toBe(key)
  }, 30_000)
})
