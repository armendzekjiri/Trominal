import type { SshAuth } from '@trominal/ssh-transport'
import { ed25519KeyPairToOpenSsh, fromBase64 } from '@trominal/crypto'
import type { HostCredentialItem, HostItem, IdentityItem } from './model'

const keyEncoder = new TextEncoder()

export async function authForHost(
  host: HostItem,
  credentials: HostCredentialItem[],
  identities: IdentityItem[],
): Promise<SshAuth | undefined> {
  const credential = credentials.find((item) => item.hostId === host.id && item.identityId !== null)
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

  return {
    privateKey: privateKey.endsWith('\n') ? privateKey : `${privateKey}\n`,
    publicKey: identity.publicKey.trim(),
  }
}
