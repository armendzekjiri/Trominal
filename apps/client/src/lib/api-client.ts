import { TrominalApiClient } from '@trominal/api-client'
import { secureStorage } from './secure-storage'

let client: TrominalApiClient | null = null

/**
 * Lazily build a singleton API client bound to the persisted server URL.
 *
 * The first call rehydrates the URL from secure storage; subsequent calls
 * return the same instance. Switching URLs requires a hard reload (acceptable
 * for the first-launch / change-server flow).
 */
export async function getApiClient(): Promise<TrominalApiClient> {
  if (client !== null) {
    return client
  }
  const baseUrl = await secureStorage.get('api_base_url')
  if (baseUrl === null || baseUrl === '') {
    throw new Error('API base URL not configured. Send the user to /connect.')
  }
  client = new TrominalApiClient({ baseUrl })
  return client
}

/** Build a one-off probe client for the connect screen, before any URL is stored. */
export function buildProbeClient(baseUrl: string): TrominalApiClient {
  return new TrominalApiClient({ baseUrl })
}

/** Clear the cached singleton so the next `getApiClient()` rebuilds it. */
export function resetApiClient(): void {
  client = null
}
