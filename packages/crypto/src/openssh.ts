import type { Ed25519KeyPair } from './keys'
import { secureRandom } from './random'
import { toBase64 } from './encoding'

export type OpenSshKeyPair = {
  publicKey: string
  privateKey: string
}

const encoder = new TextEncoder()
const OPENSSH_AUTH_MAGIC = encoder.encode('openssh-key-v1\0')
const ED25519_KEY_TYPE = 'ssh-ed25519'
const RSA_KEY_TYPE = 'ssh-rsa'

/** Convert a libsodium Ed25519 keypair into OpenSSH private and authorized_keys public text. */
export async function ed25519KeyPairToOpenSsh(
  keypair: Ed25519KeyPair,
  comment = 'trominal',
): Promise<OpenSshKeyPair> {
  if (keypair.publicKey.length !== 32 || keypair.privateKey.length !== 64) {
    throw new Error('Ed25519 OpenSSH export requires a 32-byte public key and 64-byte private key.')
  }

  const publicBlob = concat([sshString(ED25519_KEY_TYPE), sshString(keypair.publicKey)])
  const check = await secureRandom(4)
  const privateBlock = padToBlockSize(
    concat([
      check,
      check,
      sshString(ED25519_KEY_TYPE),
      sshString(keypair.publicKey),
      sshString(keypair.privateKey),
      sshString(comment),
    ]),
    8,
  )

  const envelope = concat([
    OPENSSH_AUTH_MAGIC,
    sshString('none'),
    sshString('none'),
    sshString(new Uint8Array()),
    uint32(1),
    sshString(publicBlob),
    sshString(privateBlock),
  ])

  const publicKey = `${ED25519_KEY_TYPE} ${await toBase64(publicBlob)} ${comment}`.trim()
  const privateKey = [
    '-----BEGIN OPENSSH PRIVATE KEY-----',
    wrapBase64(await toBase64(envelope)),
    '-----END OPENSSH PRIVATE KEY-----',
  ].join('\n')

  return { publicKey, privateKey }
}

/** Convert an RSA public JWK into authorized_keys text. */
export async function rsaPublicJwkToAuthorizedKey(
  jwk: JsonWebKey,
  comment = 'trominal',
): Promise<string> {
  if (jwk.kty !== 'RSA' || jwk.n === undefined || jwk.e === undefined) {
    throw new Error('RSA OpenSSH export requires an RSA public JWK with n and e parameters.')
  }

  const publicBlob = concat([
    sshString(RSA_KEY_TYPE),
    sshMpint(base64UrlToBytes(jwk.e)),
    sshMpint(base64UrlToBytes(jwk.n)),
  ])

  return `${RSA_KEY_TYPE} ${await toBase64(publicBlob)} ${comment}`.trim()
}

function sshString(value: string | Uint8Array): Uint8Array {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value
  return concat([uint32(bytes.length), bytes])
}

function sshMpint(bytes: Uint8Array): Uint8Array {
  const normalized = trimLeadingZeros(bytes)
  if (normalized.length > 0 && (normalized[0] & 0x80) !== 0) {
    return sshString(concat([new Uint8Array([0]), normalized]))
  }

  return sshString(normalized)
}

function trimLeadingZeros(bytes: Uint8Array): Uint8Array {
  let offset = 0
  while (offset < bytes.length - 1 && bytes[offset] === 0) {
    offset += 1
  }
  return bytes.slice(offset)
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function uint32(value: number): Uint8Array {
  const bytes = new Uint8Array(4)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, value, false)
  return bytes
}

function concat(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0)
  const output = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

function padToBlockSize(bytes: Uint8Array, blockSize: number): Uint8Array {
  const paddingLength = (blockSize - (bytes.length % blockSize)) % blockSize
  const padding = new Uint8Array(paddingLength)
  for (let index = 0; index < padding.length; index += 1) {
    padding[index] = index + 1
  }
  return concat([bytes, padding])
}

function wrapBase64(value: string): string {
  return value.match(/.{1,70}/g)?.join('\n') ?? value
}
