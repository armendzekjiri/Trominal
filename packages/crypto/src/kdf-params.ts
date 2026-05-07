/**
 * Argon2id parameters for vault-key derivation.
 *
 * Stored on the user record so the server can return them at login without
 * the client needing to know the current defaults. Always derive with the
 * params that were used at registration — never with hardcoded defaults.
 */
export type KdfParams = {
  version: 1
  alg: 'argon2id'
  memlimit: number
  opslimit: number
  salt_len: number
  out_len: number
}

/**
 * Default Argon2id parameters used when a user first registers.
 *
 * - 64 MiB memory
 * - 3 iterations
 * - 16-byte salt
 * - 32-byte derived key
 *
 * Future versions raise these without breaking existing users because every
 * vault item travels with the params it was created under.
 */
export const DEFAULT_KDF_PARAMS: KdfParams = {
  version: 1,
  alg: 'argon2id',
  memlimit: 64 * 1024 * 1024,
  opslimit: 3,
  salt_len: 16,
  out_len: 32,
}

/** Validate that an unknown value matches the KdfParams shape. */
export function isKdfParams(value: unknown): value is KdfParams {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    v.version === 1 &&
    v.alg === 'argon2id' &&
    typeof v.memlimit === 'number' &&
    typeof v.opslimit === 'number' &&
    typeof v.salt_len === 'number' &&
    typeof v.out_len === 'number'
  )
}
