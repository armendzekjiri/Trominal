import { sodiumReady } from './ready'

/** XChaCha20-Poly1305 nonce length (24 bytes). */
export const NONCE_BYTES = 24

/** Generate `n` cryptographically random bytes via libsodium. */
export async function secureRandom(n: number): Promise<Uint8Array> {
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`secureRandom: n must be a positive integer, got ${n}`)
  }
  const sodium = await sodiumReady()
  return sodium.randombytes_buf(n)
}

/** Generate a fresh 24-byte XChaCha20 nonce. */
export async function generateNonce(): Promise<Uint8Array> {
  return secureRandom(NONCE_BYTES)
}

/**
 * Generate a fresh 16-byte salt suitable for Argon2id KDF.
 *
 * Match the salt_len in your KdfParams.
 */
export async function generateSalt(saltLen = 16): Promise<Uint8Array> {
  return secureRandom(saltLen)
}
