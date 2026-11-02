import { isTauri } from '@/lib/platform'

/**
 * Native tunnel processes live in Rust and outlive the Tunnels page, so the
 * page's local React state is not a reliable record of what is running. This
 * module-level registry is: the page tracks every session it starts or finds
 * running, and the session lifecycle (logout, server switch) stops them all.
 */
const running = new Set<string>()

export function trackTunnelSession(sessionId: string): void {
  if (sessionId !== '') running.add(sessionId)
}

export function untrackTunnelSession(sessionId: string): void {
  running.delete(sessionId)
}

/** Ask the native side to stop every tracked tunnel. Never throws. */
export async function closeAllTunnelSessions(): Promise<void> {
  const sessionIds = [...running]
  running.clear()
  if (!isTauri || sessionIds.length === 0) return
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await Promise.allSettled(
      sessionIds.map((sessionId) => invoke('ssh_tunnel_close', { sessionId })),
    )
  } catch {
    // Native bridge unavailable — nothing more we can do from the webview.
  }
}

/** Test helper: the session ids currently tracked. */
export function trackedTunnelSessions(): readonly string[] {
  return [...running]
}
