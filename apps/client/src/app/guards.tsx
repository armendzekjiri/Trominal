import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { getApiBaseUrl } from '@/lib/config'
import { useAuth } from '@/stores/auth'
import { useVault } from '@/stores/vault'

/** Splash shown while we read secure storage and try to refresh the session. */
function HydrationSplash() {
  return (
    <div
      className="flex h-full items-center justify-center text-fg-faint text-xs"
      role="status"
      aria-live="polite"
    >
      Loading vault…
    </div>
  )
}

/** Block routes that require a configured server URL. */
export function ConnectGuard() {
  const [state, setState] = useState<'pending' | 'present' | 'absent'>('pending')
  useEffect(() => {
    let active = true
    void getApiBaseUrl().then((url) => {
      if (!active) return
      setState(url !== null && url !== '' ? 'present' : 'absent')
    })
    return () => {
      active = false
    }
  }, [])

  if (state === 'pending') return <HydrationSplash />
  if (state === 'absent') return <Navigate to="/connect" replace />
  return <Outlet />
}

/** Block routes that require an authenticated session. */
export function AuthGuard() {
  const isHydrating = useAuth((s) => s.isHydrating)
  const accessToken = useAuth((s) => s.accessToken)

  if (isHydrating) return <HydrationSplash />
  if (accessToken === null) return <Navigate to="/login" replace />
  return <Outlet />
}

/** Block routes that require an unlocked vault. */
export function VaultGuard() {
  const isLocked = useVault((s) => s.isLocked)
  if (isLocked) return <Navigate to="/unlock" replace />
  return <Outlet />
}

/** Inverse of AuthGuard — keep authed users out of the auth pages. */
export function GuestGuard() {
  const isHydrating = useAuth((s) => s.isHydrating)
  const accessToken = useAuth((s) => s.accessToken)

  if (isHydrating) return <HydrationSplash />
  if (accessToken !== null) return <Navigate to="/" replace />
  return <Outlet />
}
