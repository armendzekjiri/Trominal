import sodium from 'libsodium-wrappers-sumo'

let readyPromise: Promise<typeof sodium> | null = null

/**
 * Wait until libsodium is initialized and return the configured module.
 * Subsequent calls reuse the same promise.
 */
export function sodiumReady(): Promise<typeof sodium> {
  if (readyPromise === null) {
    readyPromise = sodium.ready.then(() => sodium)
  }
  return readyPromise
}
