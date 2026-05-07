/**
 * Wire shape for an encrypted record.
 *
 * `ct` is base64-encoded XChaCha20-Poly1305 ciphertext (includes the 16-byte
 * Poly1305 tag appended by libsodium). `n` is the base64-encoded 24-byte
 * nonce.
 */
export type Envelope = {
  v: 1
  ct: string
  n: string
}

/**
 * Build the associated-data string that must be passed to encrypt/decrypt
 * for a given resource. Binds the ciphertext to its row so a server can't
 * swap ciphertexts between resources.
 */
export function makeAd(resourceType: string, resourceId: string): string {
  if (resourceType.length === 0 || resourceId.length === 0) {
    throw new Error('makeAd: resourceType and resourceId must be non-empty')
  }
  return `trominal:v1:${resourceType}:${resourceId}`
}
