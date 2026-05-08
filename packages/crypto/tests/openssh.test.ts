import { describe, expect, it } from 'vitest'
import { fromBase64 } from '../src/encoding'
import { generateEd25519KeyPair } from '../src/keys'
import {
  ed25519KeyPairToOpenSsh,
  rsaPrivateJwkToPem,
  rsaPublicJwkToAuthorizedKey,
} from '../src/openssh'

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

  it('exports RSA private JWKs as traditional PEM keys for OpenSSH', async () => {
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
    const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
    const privateKey = await rsaPrivateJwkToPem(jwk)

    expect(privateKey).toContain('-----BEGIN RSA PRIVATE KEY-----')
    expect(privateKey).toContain('-----END RSA PRIVATE KEY-----')

    const der = await fromBase64(privateKey.replace(/-----[^-]+-----|\s/g, ''))
    expect(der[0]).toBe(0x30)
    expect(readDerInteger(der, 0).value).toEqual(new Uint8Array([0]))
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

function readDerInteger(
  bytes: Uint8Array,
  sequenceOffset: number,
): { value: Uint8Array; offset: number } {
  const sequenceLength = readDerLength(bytes, sequenceOffset + 1)
  let offset = sequenceLength.offset
  if (bytes[sequenceOffset] !== 0x30 || bytes[offset] !== 0x02) {
    throw new Error('Expected DER sequence containing an integer.')
  }

  const integerLength = readDerLength(bytes, offset + 1)
  offset = integerLength.offset
  const value = bytes.slice(offset, offset + integerLength.length)
  return { value, offset: offset + integerLength.length }
}

function readDerLength(bytes: Uint8Array, offset: number): { length: number; offset: number } {
  const first = bytes[offset]
  if (first === undefined) {
    throw new Error('Missing DER length.')
  }

  if ((first & 0x80) === 0) {
    return { length: first, offset: offset + 1 }
  }

  const octets = first & 0x7f
  let length = 0
  for (let index = 0; index < octets; index += 1) {
    const byte = bytes[offset + 1 + index]
    if (byte === undefined) {
      throw new Error('Truncated DER length.')
    }
    length = length * 256 + byte
  }

  return { length, offset: offset + 1 + octets }
}
