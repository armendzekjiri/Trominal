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

/**
 * Accepted range for version-1 parameters. KDF params come from the server,
 * so they are untrusted input: the floor keeps a tampered record from
 * weakening a new key, the ceiling keeps it from exhausting memory or CPU.
 * Mirrored server-side in `App\Support\Vault\VaultKeyMaterialRules`. A future
 * parameter set gets a new `version` rather than wider bounds here.
 */
export const KDF_LIMITS = {
  memlimitMin: 64 * 1024 * 1024,
  memlimitMax: 256 * 1024 * 1024,
  opslimitMin: 3,
  opslimitMax: 10,
  saltLen: 16,
  outLen: 32,
} as const

const KDF_KEYS = ['alg', 'memlimit', 'opslimit', 'out_len', 'salt_len', 'version']

function isIntegerBetween(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

/**
 * Validate that an unknown value is a supported, in-bounds KdfParams object.
 * Use before deriving with parameters received from the server.
 */
export function isKdfParams(value: unknown): value is KdfParams {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const v = value as Record<string, unknown>
  const keys = Object.keys(v).sort()
  return (
    keys.length === KDF_KEYS.length &&
    keys.every((key, index) => key === KDF_KEYS[index]) &&
    v.version === 1 &&
    v.alg === 'argon2id' &&
    isIntegerBetween(v.memlimit, KDF_LIMITS.memlimitMin, KDF_LIMITS.memlimitMax) &&
    v.memlimit % 1024 === 0 &&
    isIntegerBetween(v.opslimit, KDF_LIMITS.opslimitMin, KDF_LIMITS.opslimitMax) &&
    v.salt_len === KDF_LIMITS.saltLen &&
    v.out_len === KDF_LIMITS.outLen
  )
}

/** Throw unless `value` is a supported, in-bounds KdfParams object. */
export function assertKdfParams(value: unknown): asserts value is KdfParams {
  if (!isKdfParams(value)) {
    throw new Error('Unsupported KDF parameters.')
  }
}

/**
 * Hard limits enforced on every derivation, including low-cost test vectors:
 * standard output and salt lengths and the resource ceiling. The policy
 * floor is enforced separately by `isKdfParams`.
 */
export function assertKdfResourceLimits(params: KdfParams): void {
  const ok =
    params.alg === 'argon2id' &&
    params.salt_len === KDF_LIMITS.saltLen &&
    params.out_len === KDF_LIMITS.outLen &&
    isIntegerBetween(params.memlimit, 1, KDF_LIMITS.memlimitMax) &&
    isIntegerBetween(params.opslimit, 1, KDF_LIMITS.opslimitMax)
  if (!ok) {
    throw new Error('Unsupported KDF parameters.')
  }
}
