import { sodiumReady } from './ready'

/** Ed25519 keypair for signing. Public key 32 bytes, secret key 64 bytes. */
export type Ed25519KeyPair = {
  publicKey: Uint8Array
  privateKey: Uint8Array
}

/** X25519 keypair for sealed-box / key-wrapping (used for team membership in Phase 8). */
export type X25519KeyPair = {
  publicKey: Uint8Array
  privateKey: Uint8Array
}

/** Generate a fresh Ed25519 signing keypair. */
export async function generateEd25519KeyPair(): Promise<Ed25519KeyPair> {
  const sodium = await sodiumReady()
  const kp = sodium.crypto_sign_keypair()
  return { publicKey: kp.publicKey, privateKey: kp.privateKey }
}

/** Generate a fresh X25519 keypair (for `crypto_box` / sealed boxes). */
export async function generateX25519KeyPair(): Promise<X25519KeyPair> {
  const sodium = await sodiumReady()
  const kp = sodium.crypto_box_keypair()
  return { publicKey: kp.publicKey, privateKey: kp.privateKey }
}

/** Wipe a key buffer in place. Caller should drop the reference afterward. */
export function wipe(buffer: Uint8Array): void {
  buffer.fill(0)
}
