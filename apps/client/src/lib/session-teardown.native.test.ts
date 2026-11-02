import { invoke } from '@tauri-apps/api/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTransfers } from '@/features/sftp/transfersStore'
import { trackTunnelSession, trackedTunnelSessions } from '@/features/tunnels/runtime'
import { teardownSession } from './session-teardown'

vi.mock('@/lib/platform', () => ({ isTauri: true, platform: 'desktop' }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }))

afterEach(() => {
  vi.mocked(invoke).mockClear()
  useTransfers.setState({ items: [] })
})

describe('teardownSession on desktop', () => {
  it('stops every tracked native tunnel', async () => {
    trackTunnelSession('tunnel-a')
    trackTunnelSession('tunnel-b')

    await teardownSession()

    expect(invoke).toHaveBeenCalledWith('ssh_tunnel_close', { sessionId: 'tunnel-a' })
    expect(invoke).toHaveBeenCalledWith('ssh_tunnel_close', { sessionId: 'tunnel-b' })
    expect(trackedTunnelSessions()).toHaveLength(0)
  })

  it('cancels unfinished SFTP transfers but not finished ones', async () => {
    const base = { name: 'f', fromPath: '/a', toPath: '/b', hostLabel: 'h' }
    useTransfers.getState().enqueue({ ...base, id: 'pending-1', direction: 'upload' })
    useTransfers.getState().enqueue({ ...base, id: 'active-1', direction: 'download' })
    useTransfers.getState().markStarted('active-1')
    useTransfers.getState().enqueue({ ...base, id: 'done-1', direction: 'upload' })
    useTransfers.getState().markDone('done-1')

    await teardownSession()

    expect(invoke).toHaveBeenCalledWith('sftp_cancel', { transferId: 'pending-1' })
    expect(invoke).toHaveBeenCalledWith('sftp_cancel', { transferId: 'active-1' })
    expect(invoke).not.toHaveBeenCalledWith('sftp_cancel', { transferId: 'done-1' })
    expect(useTransfers.getState().items).toHaveLength(0)
  })

  it('still completes when the native bridge rejects', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('bridge gone'))
    trackTunnelSession('tunnel-c')

    await expect(teardownSession()).resolves.toBeUndefined()
  })
})
