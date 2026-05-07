import { sodiumReady } from './ready'
import { fromBase64, fromUtf8, toBase64, toUtf8 } from './encoding'
import { generateNonce, NONCE_BYTES } from './random'
import type { Envelope } from './envelope'

const KEY_BYTES = 32

function assertKey(key: Uint8Array): void {
  if (key.length !== KEY_BYTES) {
    throw new Error(`Key must be ${KEY_BYTES} bytes, got ${key.length}`)
  }
}

/**
 * Encrypt `plaintext` with XChaCha20-Poly1305-IETF and the given AEAD key.
 *
 * `ad` is the associated-data binding string built with `makeAd(...)`. It is
 * authenticated (not encrypted) and must be passed to `decrypt` unchanged.
 *
 * Always generates a fresh 24-byte random nonce. Never reuses nonces.
 */
export async function encrypt(
  plaintext: Uint8Array | string,
  key: Uint8Array,
  ad: string,
): Promise<Envelope> {
  assertKey(key)
  const sodium = await sodiumReady()
  const nonce = await generateNonce()
  const message = typeof plaintext === 'string' ? fromUtf8(plaintext) : plaintext
  const ct = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    message,
    fromUtf8(ad),
    null,
    nonce,
    key,
  )
  return {
    v: 1,
    ct: await toBase64(ct),
    n: await toBase64(nonce),
  }
}

/**
 * Encrypt a UTF-8 string with a caller-provided nonce. Used by parity tests
 * and key-rotation flows where the nonce is fixed. Production code should
 * call `encrypt`, which generates a random nonce.
 */
export async function encryptWithNonce(
  plaintext: Uint8Array | string,
  key: Uint8Array,
  ad: string,
  nonce: Uint8Array,
): Promise<Envelope> {
  assertKey(key)
  if (nonce.length !== NONCE_BYTES) {
    throw new Error(`Nonce must be ${NONCE_BYTES} bytes, got ${nonce.length}`)
  }
  const sodium = await sodiumReady()
  const message = typeof plaintext === 'string' ? fromUtf8(plaintext) : plaintext
  const ct = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    message,
    fromUtf8(ad),
    null,
    nonce,
    key,
  )
  return {
    v: 1,
    ct: await toBase64(ct),
    n: await toBase64(nonce),
  }
}

/**
 * Decrypt an envelope produced by `encrypt`. Returns the raw plaintext bytes.
 *
 * Decryption fails (throws) if `key`, `ad`, or the ciphertext have been
 * tampered with — this is the AEAD guarantee.
 */
export async function decrypt(
  envelope: Envelope,
  key: Uint8Array,
  ad: string,
): Promise<Uint8Array> {
  assertKey(key)
  if (envelope.v !== 1) {
    throw new Error(`Unsupported envelope version: ${envelope.v}`)
  }
  const sodium = await sodiumReady()
  const ct = await fromBase64(envelope.ct)
  const nonce = await fromBase64(envelope.n)
  if (nonce.length !== NONCE_BYTES) {
    throw new Error(`Nonce must be ${NONCE_BYTES} bytes, got ${nonce.length}`)
  }
  return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ct, fromUtf8(ad), nonce, key)
}

/** Convenience wrapper that decrypts and UTF-8-decodes the result. */
export async function decryptToString(
  envelope: Envelope,
  key: Uint8Array,
  ad: string,
): Promise<string> {
  return toUtf8(await decrypt(envelope, key, ad))
}
