import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { probeWebSshHostKey, WebSocketSshSession, WebSshError } from '@trominal/ssh-transport'

const PINNED = 'SHA256:OvoVOrZkNf9UDcUwx4cY++1Dz+g+98WmJKb9B3C+j2g'
const OTHER = 'SHA256:4wjNhg7/gaVDSqUJW4THt4WsoKHr/pwAQ0VbHWWRLm8'

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  binaryType = 'blob'
  sent: unknown[] = []
  closed = false
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onclose: ((event: { code: number; reason: string }) => void) | null = null

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this)
  }

  send(data: unknown): void {
    this.sent.push(data)
  }

  close(): void {
    this.closed = true
  }

  serverSends(payload: Record<string, unknown>): void {
    this.onmessage?.({ data: JSON.stringify(payload) })
  }

  firstFrame(): Record<string, unknown> {
    return JSON.parse(String(this.sent[0])) as Record<string, unknown>
  }
}

function lastSocket(): FakeWebSocket {
  const socket = FakeWebSocket.instances.at(-1)
  if (socket === undefined) throw new Error('no socket opened')
  return socket
}

const baseOptions = {
  hostId: 'host-1',
  host: 'ssh.example.com',
  port: 22,
  username: 'deploy',
  websocketUrl: 'wss://trominal.example/ws/ssh',
  websocketToken: 'a'.repeat(64),
}

describe('web SSH transport', () => {
  beforeEach(() => {
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('refuses to connect without a pinned host key and never opens a socket', async () => {
    const key = new Uint8Array([1, 2, 3])
    const session = new WebSocketSshSession({
      ...baseOptions,
      auth: { kind: 'private-key', privateKeyPem: key },
    })

    await expect(session.connect()).rejects.toMatchObject({ code: 'host_key_unknown' })
    expect(FakeWebSocket.instances).toHaveLength(0)
    expect(Array.from(key)).toEqual([0, 0, 0])
  })

  it('rejects a malformed pin before opening a socket', async () => {
    const session = new WebSocketSshSession({ ...baseOptions, hostKeyFingerprint: 'MD5:aa:bb' })

    await expect(session.connect()).rejects.toMatchObject({ code: 'invalid_frame' })
    expect(FakeWebSocket.instances).toHaveLength(0)
  })

  it('keeps the token out of the URL and sends it with the pin in the first frame', async () => {
    const session = new WebSocketSshSession({
      ...baseOptions,
      hostKeyFingerprint: PINNED,
      auth: { kind: 'password', password: 'pw' },
    })
    const connecting = session.connect()
    const socket = lastSocket()
    socket.onopen?.()
    socket.serverSends({ type: 'ready', fingerprint: PINNED, key_type: 'ssh-ed25519' })
    await connecting

    expect(socket.url).toBe(baseOptions.websocketUrl)
    expect(socket.url).not.toContain(baseOptions.websocketToken)
    expect(socket.firstFrame()).toMatchObject({
      type: 'connect',
      token: baseOptions.websocketToken,
      host_id: 'host-1',
      host: 'ssh.example.com',
      port: 22,
      host_key_fingerprint: PINNED,
    })
    expect(session.state).toBe('connected')
  })

  it('surfaces a host key mismatch with the presented fingerprint', async () => {
    const session = new WebSocketSshSession({ ...baseOptions, hostKeyFingerprint: PINNED })
    const connecting = session.connect()
    const socket = lastSocket()
    socket.onopen?.()
    socket.serverSends({
      type: 'error',
      code: 'host_key_mismatch',
      message: 'mismatch',
      fingerprint: OTHER,
      key_type: 'ecdsa-sha2-nistp256',
    })

    const error = await connecting.catch((e: unknown) => e)
    expect(error).toBeInstanceOf(WebSshError)
    expect(error).toMatchObject({
      code: 'host_key_mismatch',
      fingerprint: OTHER,
      keyType: 'ecdsa-sha2-nistp256',
    })
    expect(session.state).not.toBe('connected')
  })

  it('probes the host key without sending credentials', async () => {
    const probing = probeWebSshHostKey({
      websocketUrl: baseOptions.websocketUrl,
      websocketToken: baseOptions.websocketToken,
      hostId: 'host-1',
      host: 'ssh.example.com',
      port: 22,
    })
    const socket = lastSocket()
    socket.onopen?.()
    socket.serverSends({ type: 'host_key', fingerprint: PINNED, key_type: 'ssh-ed25519' })

    await expect(probing).resolves.toEqual({ fingerprint: PINNED, keyType: 'ssh-ed25519' })
    expect(socket.firstFrame()).toEqual({
      type: 'probe',
      token: baseOptions.websocketToken,
      host_id: 'host-1',
      host: 'ssh.example.com',
      port: 22,
    })
    expect(socket.closed).toBe(true)
  })

  it('reports probe errors such as denied destinations', async () => {
    const probing = probeWebSshHostKey({
      websocketUrl: baseOptions.websocketUrl,
      websocketToken: baseOptions.websocketToken,
      hostId: 'host-1',
      host: '10.0.0.5',
      port: 22,
    })
    const socket = lastSocket()
    socket.onopen?.()
    socket.serverSends({ type: 'error', code: 'destination_denied', message: 'denied' })

    await expect(probing).rejects.toMatchObject({ code: 'destination_denied' })
  })
})
