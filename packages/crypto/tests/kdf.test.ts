import { describe, expect, it } from 'vitest'
import { deriveVaultKey } from '../src/kdf'
import { DEFAULT_KDF_PARAMS, type KdfParams } from '../src/kdf-params'
import { fromHex, toHex } from '../src/encoding'

describe('deriveVaultKey', () => {
  it('produces a key of out_len bytes', async () => {
    const salt = new Uint8Array(16)
    const key = await deriveVaultKey('correct horse battery staple', salt, DEFAULT_KDF_PARAMS)
    expect(key.length).toBe(DEFAULT_KDF_PARAMS.out_len)
  }, 30_000)

  it('is deterministic for the same password and salt', async () => {
    const salt = new Uint8Array(16).fill(7)
    const a = await deriveVaultKey('hunter2', salt, DEFAULT_KDF_PARAMS)
    const b = await deriveVaultKey('hunter2', salt, DEFAULT_KDF_PARAMS)
    expect(await toHex(a)).toBe(await toHex(b))
  }, 60_000)

  it('rejects salts whose length does not match params.salt_len', async () => {
    const wrongSalt = new Uint8Array(8)
    await expect(deriveVaultKey('pw', wrongSalt, DEFAULT_KDF_PARAMS)).rejects.toThrow(
      /Salt length mismatch/,
    )
  })

  it('rejects unsupported algorithms', async () => {
    const params = { ...DEFAULT_KDF_PARAMS, alg: 'scrypt' } as unknown as KdfParams
    const salt = new Uint8Array(16)
    await expect(deriveVaultKey('pw', salt, params)).rejects.toThrow(/Unsupported KDF alg/)
  })

  it('matches the canonical fixture (cross-platform anchor)', async () => {
    // Anchor: Argon2id, opslimit=2, memlimit=8MiB, salt_len=16, out_len=32
    // password = "trominal-test-pw"
    // salt_hex = "00112233445566778899aabbccddeeff"
    // expected_key_hex computed once via libsodium-wrappers-sumo and verified
    // byte-equal against dryoc in packages/crypto/parity. Lowering the params
    // here keeps CI fast while still exercising the full primitive.
    const params: KdfParams = {
      version: 1,
      alg: 'argon2id',
      memlimit: 8 * 1024 * 1024,
      opslimit: 2,
      salt_len: 16,
      out_len: 32,
    }
    const salt = await fromHex('00112233445566778899aabbccddeeff')
    const key = await deriveVaultKey('trominal-test-pw', salt, params)
    expect(await toHex(key)).toBe(
      'e5f36ced31b1e823ac3974cbbe7b2904f9e89049cfc29c3a5578e788f242dfe0',
    )
  }, 30_000)
})
