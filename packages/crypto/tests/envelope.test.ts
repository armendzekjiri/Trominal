import { describe, expect, it } from 'vitest'
import { makeAd } from '../src/envelope'
import { DEFAULT_KDF_PARAMS, isKdfParams } from '../src/kdf-params'

describe('envelope helpers', () => {
  it('makeAd produces the documented format', () => {
    expect(makeAd('host_credential', 'abc')).toBe('trominal:v1:host_credential:abc')
  })

  it('makeAd rejects empty inputs', () => {
    expect(() => makeAd('', 'x')).toThrow()
    expect(() => makeAd('x', '')).toThrow()
  })
})

describe('isKdfParams', () => {
  it('accepts the default params', () => {
    expect(isKdfParams(DEFAULT_KDF_PARAMS)).toBe(true)
  })

  it('rejects malformed objects', () => {
    expect(isKdfParams(null)).toBe(false)
    expect(isKdfParams({})).toBe(false)
    expect(isKdfParams({ ...DEFAULT_KDF_PARAMS, alg: 'scrypt' })).toBe(false)
    expect(isKdfParams({ ...DEFAULT_KDF_PARAMS, version: 2 })).toBe(false)
  })
})
