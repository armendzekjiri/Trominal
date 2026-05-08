import { fromBase64, fromUtf8, toBase64 } from './encoding'
import { makeAd } from './envelope'
import type { X25519KeyPair } from './keys'
import { wipe } from './keys'
import { generateNonce, NONCE_BYTES, secureRandom } from './random'
import { sodiumReady } from './ready'

const TEAM_KEY_BYTES = 32
const X25519_KEY_BYTES = 32
const WRAP_KEY_BYTES = 32
const SEALED_BOX_OVERHEAD_BYTES = 48
const SEALED_WRAP_KEY_BYTES = WRAP_KEY_BYTES + SEALED_BOX_OVERHEAD_BYTES
const PAYLOAD_PREFIX = fromUtf8('TRTK1')

/** Context bound into a wrapped team key's AEAD associated data. */
export type TeamKeyWrapContext = {
  teamId: string
  memberId: string
  keyVersion: number
}

/** Server-storable wrapped team-key payload. */
export type WrappedTeamKey = {
  ciphertext: string
  nonce: string
}

/** Generate a fresh 32-byte symmetric team key. Caller owns and must wipe it. */
export async function generateTeamKey(): Promise<Uint8Array> {
  return secureRandom(TEAM_KEY_BYTES)
}

/** Build the associated data string for one member's wrapped team key. */
export function makeTeamKeyAd(context: TeamKeyWrapContext): string {
  assertContext(context)

  return makeAd('team_key', `${context.teamId}:member:${context.memberId}:v${context.keyVersion}`)
}

/**
 * Wrap a team key for one team member.
 *
 * The plaintext team key is encrypted with a random XChaCha20 key and AD. That
 * random wrapping key is then sealed to the recipient's X25519 public key.
 */
export async function wrapTeamKey(
  teamKey: Uint8Array,
  recipientPublicKey: Uint8Array,
  context: TeamKeyWrapContext,
): Promise<WrappedTeamKey> {
  assertBytes('teamKey', teamKey, TEAM_KEY_BYTES)
  assertBytes('recipientPublicKey', recipientPublicKey, X25519_KEY_BYTES)
  const sodium = await sodiumReady()
  const wrapKey = await secureRandom(WRAP_KEY_BYTES)

  try {
    const nonce = await generateNonce()
    const encryptedTeamKey = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      teamKey,
      fromUtf8(makeTeamKeyAd(context)),
      null,
      nonce,
      wrapKey,
    )
    const sealedWrapKey = sodium.crypto_box_seal(wrapKey, recipientPublicKey)

    return {
      ciphertext: await toBase64(joinPayload(sealedWrapKey, encryptedTeamKey)),
      nonce: await toBase64(nonce),
    }
  } finally {
    wipe(wrapKey)
  }
}

/**
 * Unwrap a team key that was wrapped for this member's X25519 keypair.
 *
 * The returned team key is secret material. Caller owns it and must wipe it
 * after use.
 */
export async function unwrapTeamKey(
  wrapped: WrappedTeamKey,
  recipientKeyPair: X25519KeyPair,
  context: TeamKeyWrapContext,
): Promise<Uint8Array> {
  assertBytes('recipient public key', recipientKeyPair.publicKey, X25519_KEY_BYTES)
  assertBytes('recipient private key', recipientKeyPair.privateKey, X25519_KEY_BYTES)
  const sodium = await sodiumReady()
  const nonce = await fromBase64(wrapped.nonce)
  assertBytes('nonce', nonce, NONCE_BYTES)

  const payload = await fromBase64(wrapped.ciphertext)
  const { sealedWrapKey, encryptedTeamKey } = splitPayload(payload)
  let wrapKey: Uint8Array | null = null

  try {
    wrapKey = sodium.crypto_box_seal_open(
      sealedWrapKey,
      recipientKeyPair.publicKey,
      recipientKeyPair.privateKey,
    )
    const teamKey = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      encryptedTeamKey,
      fromUtf8(makeTeamKeyAd(context)),
      nonce,
      wrapKey,
    )
    if (teamKey.length !== TEAM_KEY_BYTES) {
      wipe(teamKey)
      throw new Error(`Team key must be ${TEAM_KEY_BYTES} bytes, got ${teamKey.length}`)
    }

    return teamKey
  } finally {
    if (wrapKey !== null) {
      wipe(wrapKey)
    }
  }
}

function assertContext(context: TeamKeyWrapContext): void {
  if (context.teamId.trim() === '') {
    throw new Error('teamId is required')
  }
  if (context.memberId.trim() === '') {
    throw new Error('memberId is required')
  }
  if (!Number.isInteger(context.keyVersion) || context.keyVersion < 1) {
    throw new Error(`keyVersion must be a positive integer, got ${context.keyVersion}`)
  }
}

function assertBytes(name: string, value: Uint8Array, expected: number): void {
  if (value.length !== expected) {
    throw new Error(`${name} must be ${expected} bytes, got ${value.length}`)
  }
}

function joinPayload(sealedWrapKey: Uint8Array, encryptedTeamKey: Uint8Array): Uint8Array {
  const payload = new Uint8Array(
    PAYLOAD_PREFIX.length + sealedWrapKey.length + encryptedTeamKey.length,
  )
  payload.set(PAYLOAD_PREFIX, 0)
  payload.set(sealedWrapKey, PAYLOAD_PREFIX.length)
  payload.set(encryptedTeamKey, PAYLOAD_PREFIX.length + sealedWrapKey.length)

  return payload
}

function splitPayload(payload: Uint8Array): {
  sealedWrapKey: Uint8Array
  encryptedTeamKey: Uint8Array
} {
  if (payload.length <= PAYLOAD_PREFIX.length + SEALED_WRAP_KEY_BYTES) {
    throw new Error('Wrapped team key payload is too short.')
  }

  for (let i = 0; i < PAYLOAD_PREFIX.length; i++) {
    if (payload[i] !== PAYLOAD_PREFIX[i]) {
      throw new Error('Unsupported wrapped team key payload version.')
    }
  }

  const sealedStart = PAYLOAD_PREFIX.length
  const encryptedStart = sealedStart + SEALED_WRAP_KEY_BYTES

  return {
    sealedWrapKey: payload.slice(sealedStart, encryptedStart),
    encryptedTeamKey: payload.slice(encryptedStart),
  }
}
