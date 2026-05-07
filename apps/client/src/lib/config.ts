import { secureStorage } from './secure-storage'

/** Read the persisted API base URL, or null on first launch. */
export async function getApiBaseUrl(): Promise<string | null> {
  return secureStorage.get('api_base_url')
}

/** Persist a new API base URL (no validation here — the connect page validates first). */
export async function setApiBaseUrl(url: string): Promise<void> {
  await secureStorage.set('api_base_url', url.replace(/\/+$/, ''))
}

export async function clearApiBaseUrl(): Promise<void> {
  await secureStorage.delete('api_base_url')
}
