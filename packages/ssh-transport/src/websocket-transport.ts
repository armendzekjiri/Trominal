import { bytesToBase64 } from './encoding'
import { TransportEmitter } from './emitter'
import type {
  SshConnectOptions,
  SshSession,
  SshSessionState,
  Unsubscribe,
  WebSshErrorCode,
  WebSshHostKey,
  WebSshProbeOptions,
} from './types'

/**
 * Web SSH protocol (see apps/backend/app/Services/Ssh/WebSshProxy.php):
 * the first text frame carries the single-use token and is either
 * `{type:'probe', ...}` → `{type:'host_key', fingerprint, key_type}`, or
 * `{type:'connect', host_key_fingerprint, ...}` → `{type:'ready', ...}`.
 * Failures arrive as `{type:'error', code, message[, fingerprint, key_type]}`.
 */

const FINGERPRINT_PATTERN = /^SHA256:[A-Za-z0-9+/]{43}=?$/

/** A web SSH failure reported by the proxy (or detected before connecting). */
export class WebSshError extends Error {
  readonly code: WebSshErrorCode
  /** Fingerprint the server presented (set for `host_key_mismatch`). */
  readonly fingerprint?: string
  readonly keyType?: string

  constructor(code: WebSshErrorCode, message: string, hostKey?: Partial<WebSshHostKey>) {
    super(message)
    this.name = 'WebSshError'
    this.code = code
    this.fingerprint = hostKey?.fingerprint
    this.keyType = hostKey?.keyType
  }
}

type ControlFrame = {
  type?: unknown
  code?: unknown
  message?: unknown
  fingerprint?: unknown
  key_type?: unknown
}

function parseControlFrame(message: string): ControlFrame | null {
  try {
    const payload: unknown = JSON.parse(message)
    return typeof payload === 'object' && payload !== null ? (payload as ControlFrame) : null
  } catch {
    return null
  }
}

function errorFromFrame(frame: ControlFrame): WebSshError {
  const code = typeof frame.code === 'string' ? (frame.code as WebSshErrorCode) : 'session_failed'
  const message = typeof frame.message === 'string' ? frame.message : 'SSH error'
  return new WebSshError(code, message, {
    fingerprint: typeof frame.fingerprint === 'string' ? frame.fingerprint : undefined,
    keyType: typeof frame.key_type === 'string' ? frame.key_type : undefined,
  })
}

function hostKeyFromFrame(frame: ControlFrame): WebSshHostKey | null {
  if (typeof frame.fingerprint !== 'string' || typeof frame.key_type !== 'string') {
    return null
  }
  if (!FINGERPRINT_PATTERN.test(frame.fingerprint)) {
    return null
  }
  return { fingerprint: frame.fingerprint, keyType: frame.key_type }
}

export function isWellFormedHostKeyFingerprint(value: string): boolean {
  return FINGERPRINT_PATTERN.test(value)
}

/**
 * First-use host key check: asks the proxy for the host key the server
 * presents, without authenticating. Show the result to the user for explicit
 * approval, pin it in the vault, then connect with a fresh token.
 */
export async function probeWebSshHostKey(options: WebSshProbeOptions): Promise<WebSshHostKey> {
  const socket = new WebSocket(options.websocketUrl)
  socket.binaryType = 'arraybuffer'

  return new Promise<WebSshHostKey>((resolve, reject) => {
    let settled = false
    const settle = (fn: () => void) => {
      if (!settled) {
        settled = true
        fn()
      }
    }

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: 'probe',
          token: options.websocketToken,
          host_id: options.hostId,
          host: options.host,
          port: options.port,
        }),
      )
    }
    socket.onerror = () =>
      settle(() => reject(new WebSshError('connect_failed', 'WebSocket SSH connection failed.')))
    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') {
        return
      }
      const frame = parseControlFrame(event.data)
      if (frame?.type === 'host_key') {
        const hostKey = hostKeyFromFrame(frame)
        settle(() =>
          hostKey === null
            ? reject(
                new WebSshError('host_key_unavailable', 'The proxy returned an invalid host key.'),
              )
            : resolve(hostKey),
        )
        socket.close(1000, 'probe complete')
      } else if (frame?.type === 'error') {
        settle(() => reject(errorFromFrame(frame)))
      }
    }
    socket.onclose = () =>
      settle(() => reject(new WebSshError('connect_failed', 'Host key probe closed unexpectedly.')))
  })
}

export class WebSocketSshSession implements SshSession {
  readonly id: string
  private readonly emitter = new TransportEmitter()
  private socket: WebSocket | null = null
  private currentState: SshSessionState = 'closed'

  constructor(private readonly options: SshConnectOptions) {
    this.id = crypto.randomUUID()
  }

  get state(): SshSessionState {
    return this.currentState
  }

  async connect(): Promise<void> {
    const { websocketUrl, websocketToken, hostId, hostKeyFingerprint } = this.options

    if (websocketUrl === undefined) {
      throw new Error('WebSocket SSH requires a websocketUrl.')
    }
    if (websocketToken === undefined) {
      throw new Error('WebSocket SSH requires a session token.')
    }
    if (hostId === undefined) {
      throw new Error('WebSocket SSH requires a host id bound to the session token.')
    }
    // Fail closed before any credential leaves the client: the proxy refuses
    // to authenticate without a pinned host key, so never send one unpinned.
    if (hostKeyFingerprint === undefined || hostKeyFingerprint === '') {
      this.wipePrivateKey()
      throw new WebSshError(
        'host_key_unknown',
        'No pinned host key. Verify the host key fingerprint before connecting.',
      )
    }
    if (!isWellFormedHostKeyFingerprint(hostKeyFingerprint)) {
      this.wipePrivateKey()
      throw new WebSshError('invalid_frame', 'The pinned host key fingerprint is malformed.')
    }

    this.currentState = 'connecting'
    const socket = new WebSocket(websocketUrl)
    socket.binaryType = 'arraybuffer'
    this.socket = socket

    await new Promise<void>((resolve, reject) => {
      let ready = false

      socket.onopen = () => {
        socket.send(JSON.stringify(this.connectFrame(websocketToken, hostId, hostKeyFingerprint)))
        this.wipePrivateKey()
      }
      socket.onerror = () => {
        if (!ready) {
          reject(new WebSshError('connect_failed', 'WebSocket SSH connection failed.'))
        }
      }
      socket.onmessage = (event) => {
        if (typeof event.data === 'string') {
          const frame = parseControlFrame(event.data)
          if (frame?.type === 'ready') {
            ready = true
            this.currentState = 'connected'
            resolve()
            return
          }
          if (frame?.type === 'error') {
            const error = errorFromFrame(frame)
            if (ready) {
              this.emitter.emitClose(error.message)
            } else {
              reject(error)
            }
            return
          }
          if (!ready) {
            return
          }
          this.emitter.emitData(new TextEncoder().encode(event.data))
          return
        }
        if (ready) {
          this.emitter.emitData(new Uint8Array(event.data as ArrayBuffer))
        }
      }
      socket.onclose = (event) => {
        this.currentState = 'closed'
        this.wipePrivateKey()
        if (!ready) {
          reject(new WebSshError('connect_failed', event.reason || `closed:${event.code}`))
          return
        }
        this.emitter.emitClose(event.reason || `closed:${event.code}`)
      }
    })
  }

  write(data: Uint8Array): void {
    if (this.currentState === 'connected') {
      this.socket?.send(data)
    }
  }

  resize(cols: number, rows: number): void {
    if (this.currentState === 'connected') {
      this.socket?.send(JSON.stringify({ type: 'resize', cols, rows }))
    }
  }

  async close(): Promise<void> {
    this.wipePrivateKey()
    this.socket?.close(1000, 'client closed')
    this.socket = null
    this.currentState = 'closed'
  }

  onData(cb: (chunk: Uint8Array) => void): Unsubscribe {
    return this.emitter.onData(cb)
  }

  onClose(cb: (reason: string) => void): Unsubscribe {
    return this.emitter.onClose(cb)
  }

  private connectFrame(
    token: string,
    hostId: string,
    hostKeyFingerprint: string,
  ): Record<string, unknown> {
    const auth = this.options.auth
    return {
      type: 'connect',
      token,
      host_id: hostId,
      host: this.options.host,
      port: this.options.port,
      host_key_fingerprint: hostKeyFingerprint,
      username: this.options.username,
      cols: this.options.cols ?? 80,
      rows: this.options.rows ?? 24,
      auth:
        auth?.kind === 'private-key'
          ? {
              kind: auth.kind,
              private_key_pem_b64: bytesToBase64(auth.privateKeyPem),
              passphrase: auth.passphrase,
            }
          : auth,
    }
  }

  private wipePrivateKey(): void {
    if (this.options.auth?.kind === 'private-key') {
      this.options.auth.privateKeyPem.fill(0)
    }
  }
}
