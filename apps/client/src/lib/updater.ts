import { isTauri } from './platform'
import type { Update } from '@tauri-apps/plugin-updater'

export type UpdaterCheckResult =
  | { kind: 'web' }
  | { kind: 'current' }
  | { kind: 'available'; update: Update }

export async function checkForDesktopUpdate(): Promise<UpdaterCheckResult> {
  if (!isTauri) {
    return { kind: 'web' }
  }

  const { check } = await import('@tauri-apps/plugin-updater')
  const update = await check({ timeout: 15_000 })

  return update === null ? { kind: 'current' } : { kind: 'available', update }
}

export async function installDesktopUpdate(
  update: Update,
  onProgress: (receivedBytes: number, totalBytes: number | null) => void,
): Promise<void> {
  let receivedBytes = 0
  let totalBytes: number | null = null

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        receivedBytes = 0
        totalBytes = event.data.contentLength ?? null
        onProgress(receivedBytes, totalBytes)
        break
      case 'Progress':
        receivedBytes += event.data.chunkLength
        onProgress(receivedBytes, totalBytes)
        break
      case 'Finished':
        if (totalBytes !== null) {
          receivedBytes = totalBytes
        }
        onProgress(receivedBytes, totalBytes)
        break
    }
  })
}
