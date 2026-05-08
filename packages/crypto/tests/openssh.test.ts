import { describe, expect, it } from 'vitest'
import { fromBase64 } from '../src/encoding'
import { generateEd25519KeyPair } from '../src/keys'
import { ed25519KeyPairToOpenSsh, rsaPublicJwkToAuthorizedKey } from '../src/openssh'

describe('OpenSSH key export', () => {
  it('exports Ed25519 keys in OpenSSH-compatible text formats', async () => {
    const keypair = await generateEd25519KeyPair()
    const exported = await ed25519KeyPairToOpenSsh(keypair, 'unit@example.test')

    expect(exported.publicKey).toMatch(/^ssh-ed25519 [A-Za-z0-9+/=]+ unit@example\.test$/)
    expect(exported.privateKey).toContain('-----BEGIN OPENSSH PRIVATE KEY-----')
    expect(exported.privateKey).toContain('-----END OPENSSH PRIVATE KEY-----')

    const publicBlob = await fromBase64(exported.publicKey.split(' ')[1] ?? '')
    expect(readSshString(publicBlob, 0).value).toBe('ssh-ed25519')

    const privateEnvelope = await fromBase64(exported.privateKey.replace(/-----[^-]+-----|\s/g, ''))
    expect(new TextDecoder().decode(privateEnvelope.slice(0, 15))).toBe('openssh-key-v1\0')
  })

  it('rejects invalid Ed25519 key sizes', async () => {
    await expect(
      ed25519KeyPairToOpenSsh({
        publicKey: new Uint8Array(31),
        privateKey: new Uint8Array(64),
      }),
    ).rejects.toThrow(/32-byte public key/)
  })

  it('exports RSA public JWKs in authorized_keys format', async () => {
    const pair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    )
    const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
    const publicKey = await rsaPublicJwkToAuthorizedKey(jwk, 'rsa@example.test')

    expect(publicKey).toMatch(/^ssh-rsa [A-Za-z0-9+/=]+ rsa@example\.test$/)
    const publicBlob = await fromBase64(publicKey.split(' ')[1] ?? '')
    expect(readSshString(publicBlob, 0).value).toBe('ssh-rsa')
  })
})

function readSshString(bytes: Uint8Array, offset: number): { value: string; offset: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const length = view.getUint32(offset, false)
  const start = offset + 4
  const end = start + length
  return {
    value: new TextDecoder().decode(bytes.slice(start, end)),
    offset: end,
  }
}
