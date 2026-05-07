import { describe, expect, it } from 'vitest'
import { decrypt, decryptToString, encrypt, encryptWithNonce } from '../src/encrypt'
import { fromHex, fromUtf8 } from '../src/encoding'
import { makeAd } from '../src/envelope'
import { generateNonce, secureRandom } from '../src/random'

describe('encrypt / decrypt', () => {
  it('round-trips a UTF-8 string with a fresh key', async () => {
    const key = await secureRandom(32)
    const ad = makeAd('host_credential', 'cred_01HXYZ')
    const envelope = await encrypt('correct horse battery staple', key, ad)
    expect(envelope.v).toBe(1)
    expect(envelope.ct).not.toBe('')
    expect(envelope.n).not.toBe('')
    expect(await decryptToString(envelope, key, ad)).toBe('correct horse battery staple')
  })

  it('round-trips raw bytes', async () => {
    const key = await secureRandom(32)
    const ad = makeAd('user_private_key', 'user@example.com')
    const plaintext = await secureRandom(64)
    const envelope = await encrypt(plaintext, key, ad)
    const decrypted = await decrypt(envelope, key, ad)
    expect(Buffer.from(decrypted).toString('hex')).toBe(Buffer.from(plaintext).toString('hex'))
  })

  it('fails when the AD does not match', async () => {
    const key = await secureRandom(32)
    const envelope = await encrypt('secret', key, makeAd('host_credential', 'A'))
    await expect(decrypt(envelope, key, makeAd('host_credential', 'B'))).rejects.toThrow()
  })

  it('fails when the key does not match', async () => {
    const keyA = await secureRandom(32)
    const keyB = await secureRandom(32)
    const ad = makeAd('snippet', '1')
    const envelope = await encrypt('secret', keyA, ad)
    await expect(decrypt(envelope, keyB, ad)).rejects.toThrow()
  })

  it('fails when the ciphertext is tampered with', async () => {
    const key = await secureRandom(32)
    const ad = makeAd('snippet', '1')
    const envelope = await encrypt('secret', key, ad)
    const tampered = { ...envelope, ct: toBase64Mutated(envelope.ct) }
    await expect(decrypt(tampered, key, ad)).rejects.toThrow()
  })

  it('rejects keys that are not 32 bytes', async () => {
    const shortKey = new Uint8Array(16)
    await expect(encrypt('x', shortKey, makeAd('snippet', '1'))).rejects.toThrow(/Key must be 32/)
  })

  it('encryptWithNonce produces deterministic ciphertext for fixed inputs', async () => {
    const key = await fromHex('0101010101010101010101010101010101010101010101010101010101010101')
    const nonce = await fromHex('020202020202020202020202020202020202020202020202')
    const ad = makeAd('test', '1')
    const a = await encryptWithNonce(fromUtf8('Hello'), key, ad, nonce)
    const b = await encryptWithNonce(fromUtf8('Hello'), key, ad, nonce)
    expect(a.ct).toBe(b.ct)
    expect(a.n).toBe(b.n)
  })

  it('encrypt produces a fresh 24-byte nonce on every call', async () => {
    const key = await secureRandom(32)
    const ad = makeAd('snippet', '1')
    const a = await encrypt('same', key, ad)
    const b = await encrypt('same', key, ad)
    expect(a.n).not.toBe(b.n)
  })

  it('generateNonce returns 24 bytes', async () => {
    expect((await generateNonce()).length).toBe(24)
  })
})

/** Flip a byte in a base64 string by re-encoding from a mutated buffer. */
function toBase64Mutated(b64: string): string {
  const buf = Buffer.from(b64, 'base64')
  buf[0] = (buf[0] ?? 0) ^ 0x80
  return toBase64Sync(buf)
}

function toBase64Sync(buf: Buffer): string {
  // libsodium ORIGINAL = standard base64 with padding — Buffer matches.
  return buf.toString('base64')
}
