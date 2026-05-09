import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_KDF_PARAMS,
  deriveVaultKey,
  encrypt,
  generateSalt,
  generateX25519KeyPair,
  makeAd,
  toBase64,
} from '@trominal/crypto'
import type { UserVaultMaterial } from '@trominal/api-client'
import { useTeamScope } from '@/features/teams/store'
import { useVault } from './vault'

const TEST_EMAIL = 'unlock-test@example.com'
const TEST_MASTER_PW = 'correct horse battery staple 1!'

async function makeMaterial(): Promise<{ material: UserVaultMaterial; key: Uint8Array }> {
  const params = { ...DEFAULT_KDF_PARAMS, memlimit: 8 * 1024 * 1024, opslimit: 2 }
  const salt = await generateSalt(params.salt_len)
  const key = await deriveVaultKey(TEST_MASTER_PW, salt, params)
  const kp = await generateX25519KeyPair()
  const env = await encrypt(kp.privateKey, key, makeAd('user_private_key', TEST_EMAIL))
  return {
    key,
    material: {
      kdf_salt: await toBase64(salt),
      kdf_params: params,
      public_key: await toBase64(kp.publicKey),
      private_key_ciphertext: env.ct,
      private_key_nonce: env.n,
    },
  }
}

beforeEach(() => {
  useVault.getState().lock()
  useTeamScope.getState().setPersonalScope()
})

afterEach(() => {
  useVault.getState().lock()
  useTeamScope.getState().setPersonalScope()
})

describe('vault store', () => {
  it('unlocks with the right master password and exposes the key', async () => {
    const { material } = await makeMaterial()
    useVault.getState().setMaterial(material)
    await useVault.getState().unlock(TEST_MASTER_PW, TEST_EMAIL)
    const state = useVault.getState()
    expect(state.isLocked).toBe(false)
    expect(state.key).not.toBeNull()
    expect(state.key?.length).toBe(32)
  }, 30_000)

  it('refuses the wrong master password and stays locked', async () => {
    const { material } = await makeMaterial()
    useVault.getState().setMaterial(material)
    await expect(useVault.getState().unlock('wrong-password', TEST_EMAIL)).rejects.toThrow(
      /Incorrect master password/,
    )
    expect(useVault.getState().isLocked).toBe(true)
    expect(useVault.getState().key).toBeNull()
  }, 30_000)

  it('lock() wipes the key bytes in place before dropping the reference', async () => {
    const { material } = await makeMaterial()
    useVault.getState().setMaterial(material)
    await useVault.getState().unlock(TEST_MASTER_PW, TEST_EMAIL)
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
