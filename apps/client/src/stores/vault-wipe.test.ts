import { afterEach, describe, expect, it, vi } from 'vitest'
import * as crypto from '@trominal/crypto'
import type { UserVaultMaterial } from '@trominal/api-client'
import { useVault } from './vault'

/** Every plaintext buffer `decrypt` hands back, so the test can inspect it later. */
const decrypted: Uint8Array[] = []

vi.mock('@trominal/crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@trominal/crypto')>()
  return {
    ...actual,
    decrypt: async (...args: Parameters<typeof actual.decrypt>) => {
      const plaintext = await actual.decrypt(...args)
      decrypted.push(plaintext)
      return plaintext
    },
  }
})

vi.mock('@/lib/api-client', () => ({
  getApiClient: async () => ({
    rebindPrivateKey: async () => {
      throw new Error('offline')
    },
  }),
}))

const OWNER = { id: '01jbz8w0q9x3t7k2m4n6p8r0s3', email: 'wipe@example.com' }
const MASTER = 'correct horse battery staple 2!'

async function material(ad: string): Promise<UserVaultMaterial> {
  const salt = await crypto.generateSalt(16)
  const key = await crypto.deriveVaultKey(MASTER, salt, crypto.DEFAULT_KDF_PARAMS)
  const kp = await crypto.generateX25519KeyPair()
  const env = await crypto.encrypt(kp.privateKey, key, ad)
  crypto.wipe(key)
  return {
    kdf_salt: await crypto.toBase64(salt),
    kdf_params: crypto.DEFAULT_KDF_PARAMS,
    public_key: await crypto.toBase64(kp.publicKey),
    private_key_ciphertext: env.ct,
    private_key_nonce: env.n,
    vault_version: 1,
    private_key_ad_version: 1,
  }
}

afterEach(() => {
  useVault.getState().lock()
  decrypted.length = 0
})

describe('vault unlock secret lifecycle', () => {
  it('wipes the decrypted private-key canary after unlocking', async () => {
    useVault.getState().setMaterial(await material(crypto.makeAd('user_private_key', OWNER.id)))
    await useVault.getState().unlock(MASTER, OWNER)

    expect(decrypted.length).toBeGreaterThan(0)
    for (const buffer of decrypted) {
      expect(Array.from(buffer).every((byte) => byte === 0)).toBe(true)
    }
  }, 30_000)

  it('wipes the canary on the legacy-AD path as well', async () => {
    useVault.getState().setMaterial(await material(crypto.makeAd('user_private_key', OWNER.email)))
    await useVault.getState().unlock(MASTER, OWNER)

    expect(useVault.getState().isLocked).toBe(false)
    expect(decrypted.length).toBeGreaterThan(0)
    for (const buffer of decrypted) {
      expect(Array.from(buffer).every((byte) => byte === 0)).toBe(true)
    }
  }, 30_000)
})
