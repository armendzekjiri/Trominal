import { useEffect } from 'react'
import { useVault } from '@/stores/vault'

/**
 * Single document-level idle listener that resets the vault auto-lock timer on
 * any user input. Mount once at the app root.
 */
export function useIdleResetEffect(): void {
  const isLocked = useVault((s) => s.isLocked)
  useEffect(() => {
    if (isLocked) {
      return
    }
    const reset = (): void => {
      useVault.getState().resetIdle()
    }
    const events: Array<keyof DocumentEventMap> = [
      'mousemove',
      'keydown',
      'pointerdown',
      'touchstart',
      'wheel',
    ]
    for (const ev of events) {
      document.addEventListener(ev, reset, { passive: true })
    }
    reset()
    return () => {
      for (const ev of events) {
        document.removeEventListener(ev, reset)
      }
    }
  }, [isLocked])
}
