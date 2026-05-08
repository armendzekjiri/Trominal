import type { SshAuth } from '@trominal/ssh-transport'
import { ed25519KeyPairToOpenSsh, fromBase64, rsaPrivateJwkToPem } from '@trominal/crypto'
import type { HostCredentialItem, HostItem, IdentityItem } from './model'
import { latestHostCredentialForHost } from './host-credentials'

const keyEncoder = new TextEncoder()
const RSA_PUBLIC_KEY_PREFIX = 'ssh-rsa '

export async function authForHost(
  host: HostItem,
  credentials: HostCredentialItem[],
  identities: IdentityItem[],
): Promise<SshAuth | undefined> {
  const credential = latestHostCredentialForHost(host.id, credentials)
  const identity = identities.find((item) => item.id === credential?.identityId)

  if (identity === undefined || identity.privateKey.trim() === '') {
    return undefined
  }

  return authForIdentity(identity, credential?.privateKeyPassphrase || undefined)
}

export async function authForIdentity(
  identity: IdentityItem,
  passphrase?: string,
): Promise<SshAuth> {
  const key = await normalizeIdentityKey(identity)

  return {
    kind: 'private-key',
    privateKeyPem: keyEncoder.encode(key.privateKey),
    publicKey: key.publicKey,
    passphrase,
  }
}

async function normalizeIdentityKey(identity: IdentityItem): Promise<{
  privateKey: string
  publicKey: string
}> {
  const privateKey = identity.privateKey.trim()

  if (privateKey.startsWith('ed25519:') && identity.publicKey.startsWith('ed25519:')) {
    const publicKey = await fromBase64(identity.publicKey.slice('ed25519:'.length))
    const secretKey = await fromBase64(privateKey.slice('ed25519:'.length))
    try {
      return await ed25519KeyPairToOpenSsh(
        {
          publicKey,
          privateKey: secretKey,
        },
        identity.name || 'trominal',
      )
    } finally {
      secretKey.fill(0)
    }
  }

  if (isRsaIdentity(identity) && privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
    return {
      privateKey: ensureTrailingNewline(await rsaPkcs8PrivateKeyToPem(privateKey)),
      publicKey: identity.publicKey.trim(),
    }
  }

  return {
    privateKey: ensureTrailingNewline(privateKey),
    publicKey: identity.publicKey.trim(),
  }
}

function isRsaIdentity(identity: IdentityItem): boolean {
  return (
    identity.keyType.toLowerCase().includes('rsa') ||
    identity.publicKey.trim().startsWith(RSA_PUBLIC_KEY_PREFIX)
  )
}

async function rsaPkcs8PrivateKeyToPem(privateKey: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(privateKey, 'PRIVATE KEY'),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    true,
    ['sign'],
  )
  const jwk = await crypto.subtle.exportKey('jwk', key)
  return rsaPrivateJwkToPem(jwk)
}

function pemToBytes(pem: string, label: string): Uint8Array {
  const pattern = new RegExp(`-----BEGIN ${label}-----([\\s\\S]+?)-----END ${label}-----`)
  const match = pem.match(pattern)
  if (match === null || match[1] === undefined) {
    throw new Error(`Expected ${label} PEM text.`)
  }

  const binary = atob(match[1].replace(/\s/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith('\n') ? value : `${value}\n`
}
