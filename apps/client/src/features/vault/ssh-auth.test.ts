import { rsaPublicJwkToAuthorizedKey } from '@trominal/crypto'
import { describe, expect, it } from 'vitest'
import { authForIdentity } from './ssh-auth'
import type { IdentityItem } from './model'

describe('SSH identity auth', () => {
  it('normalizes generated RSA PKCS#8 private keys to OpenSSH-compatible RSA PEM', async () => {
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
    const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
    const privateKey = await crypto.subtle.exportKey('pkcs8', pair.privateKey)
    const identity: IdentityItem = {
      id: 'identity_rsa',
      teamId: null,
      name: 'rsa unit',
      keyType: 'rsa-4096',
      publicKey: await rsaPublicJwkToAuthorizedKey(publicJwk, 'rsa@example.test'),
      privateKey: pem('PRIVATE KEY', privateKey),
      updatedAt: null,
    }

    const auth = await authForIdentity(identity)

    expect(auth.kind).toBe('private-key')
    if (auth.kind === 'private-key') {
      expect(new TextDecoder().decode(auth.privateKeyPem)).toContain(
        '-----BEGIN RSA PRIVATE KEY-----',
      )
    }
  })
})

function pem(label: string, bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes))
  const base64 =
    btoa(binary)
      .match(/.{1,64}/g)
      ?.join('\n') ?? ''
  return `-----BEGIN ${label}-----\n${base64}\n-----END ${label}-----`
}
