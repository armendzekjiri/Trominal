import { describe, expect, it } from 'vitest'
import { generateEd25519KeyPair, generateX25519KeyPair, wipe } from '../src/keys'

describe('keypair generation', () => {
  it('Ed25519 has 32-byte public and 64-byte secret', async () => {
    const kp = await generateEd25519KeyPair()
    expect(kp.publicKey.length).toBe(32)
    expect(kp.privateKey.length).toBe(64)
  })

  it('X25519 has 32-byte public and secret', async () => {
    const kp = await generateX25519KeyPair()
    expect(kp.publicKey.length).toBe(32)
    expect(kp.privateKey.length).toBe(32)
  })

  it('Ed25519 produces fresh keypairs', async () => {
    const a = await generateEd25519KeyPair()
    const b = await generateEd25519KeyPair()
    expect(Buffer.from(a.privateKey).equals(Buffer.from(b.privateKey))).toBe(false)
  })

  it('wipe zeroes the buffer in place', () => {
    const buf = new Uint8Array([1, 2, 3, 4])
    wipe(buf)
    expect(Array.from(buf)).toEqual([0, 0, 0, 0])
  })
})
