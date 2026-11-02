import { describe, expect, it } from 'vitest'
import { deriveVaultKey } from '../src/kdf'
import {
  assertKdfParams,
  DEFAULT_KDF_PARAMS,
  isKdfParams,
  KDF_LIMITS,
  type KdfParams,
} from '../src/kdf-params'

const MiB = 1024 * 1024

describe('KDF parameter bounds', () => {
  it('accepts the defaults and the documented extremes', () => {
    expect(isKdfParams(DEFAULT_KDF_PARAMS)).toBe(true)
    expect(
      isKdfParams({
        ...DEFAULT_KDF_PARAMS,
        memlimit: KDF_LIMITS.memlimitMax,
        opslimit: KDF_LIMITS.opslimitMax,
      }),
    ).toBe(true)
    expect(KDF_LIMITS.memlimitMin).toBe(64 * MiB)
    expect(KDF_LIMITS.memlimitMax).toBe(256 * MiB)
    expect(KDF_LIMITS.opslimitMin).toBe(3)
    expect(KDF_LIMITS.opslimitMax).toBe(10)
  })

  it.each([
    ['memlimit below the floor', { memlimit: 8 * MiB }],
    ['memlimit above the ceiling', { memlimit: 4096 * MiB }],
    ['memlimit not a multiple of 1 KiB', { memlimit: 64 * MiB + 1 }],
    ['fractional memlimit', { memlimit: 64 * MiB + 0.5 }],
    ['opslimit below the floor', { opslimit: 1 }],
    ['opslimit above the ceiling', { opslimit: 1000 }],
    ['non-integer opslimit', { opslimit: 3.5 }],
    ['NaN opslimit', { opslimit: Number.NaN }],
    ['salt_len other than 16', { salt_len: 32 }],
    ['out_len other than 32', { out_len: 64 }],
    ['unsupported version', { version: 2 }],
    ['unsupported alg', { alg: 'argon2i' }],
    ['unknown key', { extra: true }],
  ])('rejects %s', (_name, override) => {
    const candidate = { ...DEFAULT_KDF_PARAMS, ...override }
    expect(isKdfParams(candidate)).toBe(false)
    expect(() => assertKdfParams(candidate)).toThrow(/KDF parameters/)
  })

  it('rejects params with missing keys', () => {
    const partial: Partial<KdfParams> = { ...DEFAULT_KDF_PARAMS }
    delete partial.out_len
    expect(isKdfParams(partial)).toBe(false)
  })
})

describe('deriveVaultKey resource limits', () => {
  it('refuses memlimit/opslimit above the ceiling before allocating', async () => {
    const salt = new Uint8Array(16)
    const huge = { ...DEFAULT_KDF_PARAMS, memlimit: 4096 * MiB } as KdfParams
    await expect(deriveVaultKey('pw', salt, huge)).rejects.toThrow(/KDF parameters/)
    const slow = { ...DEFAULT_KDF_PARAMS, opslimit: 1_000_000 } as KdfParams
    await expect(deriveVaultKey('pw', salt, slow)).rejects.toThrow(/KDF parameters/)
  })

  it('requires exactly 32-byte output and 16-byte salt', async () => {
    const wide = { ...DEFAULT_KDF_PARAMS, out_len: 64 } as KdfParams
    await expect(deriveVaultKey('pw', new Uint8Array(16), wide)).rejects.toThrow(/KDF parameters/)
    const longSalt = { ...DEFAULT_KDF_PARAMS, salt_len: 32 } as KdfParams
    await expect(deriveVaultKey('pw', new Uint8Array(32), longSalt)).rejects.toThrow(
      /KDF parameters/,
    )
  })
})
