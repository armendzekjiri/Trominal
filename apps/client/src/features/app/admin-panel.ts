import { getApiBaseUrl } from '@/lib/config'
import { openExternal } from '@/lib/open-external'

/** Opens the connected server's Filament panel (`<server>/admin`) in the system browser. */
export async function openAdminPanel(): Promise<void> {
  const base = await getApiBaseUrl()
  if (base === null || base === '') return
  await openExternal(new URL('/admin', base).toString())
}
