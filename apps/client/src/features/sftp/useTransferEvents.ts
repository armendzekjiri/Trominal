import { useEffect } from 'react'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { SftpTransferEvent } from './types'
import { useTransfers } from './transfersStore'

/**
 * Subscribe to `sftp://transfer` events emitted from the Rust monitor thread
 * and feed them into the transfer-queue store. The hook auto-tears down its
 * Tauri listener on unmount.
 */
export function useTransferEvents(): void {
  const markStarted = useTransfers((s) => s.markStarted)
  const markDone = useTransfers((s) => s.markDone)
  const markError = useTransfers((s) => s.markError)

  useEffect(() => {
    let unlisten: UnlistenFn | undefined
    let cancelled = false

    void listen<SftpTransferEvent>('sftp://transfer', (event) => {
      const payload = event.payload
      switch (payload.state) {
        case 'started':
          markStarted(payload.transferId)
          break
        case 'done':
          markDone(payload.transferId)
          break
        case 'error':
          markError(payload.transferId, payload.message ?? 'Transfer failed.')
          break
      }
    }).then((handler) => {
      if (cancelled) {
        handler()
      } else {
        unlisten = handler
      }
    })

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [markStarted, markDone, markError])
}
