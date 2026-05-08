import { bytesToBase64 } from './encoding'
import { TransportEmitter } from './emitter'
import type { SshConnectOptions, SshSession, SshSessionState, Unsubscribe } from './types'

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
    if (this.options.websocketUrl === undefined) {
      throw new Error('WebSocket SSH requires a websocketUrl.')
    }

    this.currentState = 'connecting'
    const socket = new WebSocket(this.options.websocketUrl)
    socket.binaryType = 'arraybuffer'
    this.socket = socket

    await new Promise<void>((resolve, reject) => {
      socket.onopen = () => {
        this.currentState = 'connected'
        socket.send(JSON.stringify(this.connectFrame()))
        this.wipePrivateKey()
        resolve()
      }
      socket.onerror = () => reject(new Error('WebSocket SSH connection failed.'))
      socket.onmessage = (event) => {
        if (typeof event.data === 'string') {
          if (this.handleControlMessage(event.data)) {
            return
          }
          this.emitter.emitData(new TextEncoder().encode(event.data))
          return
        }
        this.emitter.emitData(new Uint8Array(event.data as ArrayBuffer))
      }
      socket.onclose = (event) => {
        this.currentState = 'closed'
        this.emitter.emitClose(event.reason || `closed:${event.code}`)
      }
    })
  }

  write(data: Uint8Array): void {
    this.socket?.send(data)
  }

  resize(cols: number, rows: number): void {
    this.socket?.send(JSON.stringify({ type: 'resize', cols, rows }))
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

  private connectFrame(): Record<string, unknown> {
    const auth = this.options.auth
    return {
      type: 'connect',
      host_id: this.options.hostId,
      host: this.options.host,
      port: this.options.port,
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

  private handleControlMessage(message: string): boolean {
    try {
      const payload = JSON.parse(message) as { type?: unknown; message?: unknown }
      if (payload.type === 'error') {
        this.emitter.emitClose(typeof payload.message === 'string' ? payload.message : 'SSH error')
        return true
      }
      return payload.type === 'ready'
    } catch {
      return false
    }
  }

  private wipePrivateKey(): void {
    if (this.options.auth?.kind === 'private-key') {
      this.options.auth.privateKeyPem.fill(0)
    }
  }
}
