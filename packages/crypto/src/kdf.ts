import { sodiumReady } from './ready'
import type { KdfParams } from './kdf-params'

/**
 * Derive a 32-byte vault key from a master password using Argon2id.
 *
 * Both client and server must call this with the params that were stored at
 * registration time. Never hardcode params here — always pass them in.
 *
 * @param password Master password as a UTF-8 string. Never sent to the server.
 * @param salt Per-user salt of length `params.salt_len`.
 * @param params KdfParams retrieved from the server (or DEFAULT_KDF_PARAMS on first signup).
 * @returns The derived key bytes (length = `params.out_len`).
 */
export async function deriveVaultKey(
  password: string,
  salt: Uint8Array,
  params: KdfParams,
): Promise<Uint8Array> {
  if (params.alg !== 'argon2id') {
    throw new Error(`Unsupported KDF alg: ${params.alg}`)
  }
  if (salt.length !== params.salt_len) {
    throw new Error(`Salt length mismatch: expected ${params.salt_len}, got ${salt.length}`)
  }

  const sodium = await sodiumReady()
  return sodium.crypto_pwhash(
    params.out_len,
    password,
    salt,
    params.opslimit,
    params.memlimit,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  )
}
