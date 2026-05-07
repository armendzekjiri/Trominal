import { useEffect, useState } from 'react'
import { getApiBaseUrl } from '@/lib/config'

/** Hostname-only display for the server badge (`https://x.example/` → `x.example`). */
export function useServerDisplay(): string | undefined {
  const [server, setServer] = useState<string | undefined>(undefined)
  useEffect(() => {
    let active = true
    void getApiBaseUrl().then((url) => {
      if (!active) return
      if (url === null || url === '') {
        setServer(undefined)
        return
      }
      try {
        setServer(new URL(url).host)
      } catch {
        setServer(url)
      }
    })
    return () => {
      active = false
    }
  }, [])
  return server
}
