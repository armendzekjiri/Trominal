import { sodiumReady } from './ready'

/** Base64 (no padding, URL-safe) encode using libsodium for portability with Rust. */
export async function toBase64(bytes: Uint8Array): Promise<string> {
  const sodium = await sodiumReady()
  return sodium.to_base64(bytes, sodium.base64_variants.ORIGINAL)
}

/** Decode a libsodium-style base64 string back to bytes. */
export async function fromBase64(value: string): Promise<Uint8Array> {
  const sodium = await sodiumReady()
  return sodium.from_base64(value, sodium.base64_variants.ORIGINAL)
}

/** Hex-encode for fixture and parity-test interop with Rust. */
export async function toHex(bytes: Uint8Array): Promise<string> {
  const sodium = await sodiumReady()
  return sodium.to_hex(bytes)
}

/** Decode hex back to bytes. */
export async function fromHex(value: string): Promise<Uint8Array> {
  const sodium = await sodiumReady()
  return sodium.from_hex(value)
}

/**
 * UTF-8 encode a string to bytes.
 *
 * Re-wraps the result in a fresh `Uint8Array` from the current realm because
 * jsdom's `TextEncoder` returns a foreign-realm typed array that libsodium's
 * `instanceof` check rejects.
 */
export function fromUtf8(value: string): Uint8Array {
  const encoded = new TextEncoder().encode(value)
  return new Uint8Array(encoded.buffer, encoded.byteOffset, encoded.byteLength)
}

/** UTF-8 decode bytes back to a string. */
export function toUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}
