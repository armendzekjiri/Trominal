import { TransportEmitter } from './emitter'
import type { SshConnectOptions, SshSession, SshSessionState, Unsubscribe } from './types'

type TauriCore = {
  invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>
}

export class NativeSshSession implements SshSession {
  readonly id: string
  private readonly emitter = new TransportEmitter()
  private currentState: SshSessionState = 'closed'
  private nativeSessionId: string | null = null

  constructor(private readonly options: SshConnectOptions) {
    this.id = crypto.randomUUID()
  }

  get state(): SshSessionState {
    return this.currentState
  }

  async connect(): Promise<void> {
    this.currentState = 'connecting'
    const { invoke } = await this.tauri()
    try {
      this.nativeSessionId = await invoke<string>('ssh_connect', {
        host: this.options.host,
        port: this.options.port,
        username: this.options.username,
        auth: this.options.auth,
        cols: this.options.cols ?? 80,
        rows: this.options.rows ?? 24,
      })
      this.currentState = 'connected'
    } finally {
      this.wipePrivateKey()
    }
  }

  write(data: Uint8Array): void {
    if (this.nativeSessionId === null) {
      return
    }
    void this.tauri().then(({ invoke }) =>
      invoke('ssh_write', { sessionId: this.nativeSessionId, data: Array.from(data) }),
    )
  }

  resize(cols: number, rows: number): void {
    if (this.nativeSessionId === null) {
      return
    }
    void this.tauri().then(({ invoke }) =>
      invoke('ssh_resize', { sessionId: this.nativeSessionId, cols, rows }),
    )
  }

  async close(): Promise<void> {
    this.wipePrivateKey()
    if (this.nativeSessionId !== null) {
      const { invoke } = await this.tauri()
      await invoke('ssh_close', { sessionId: this.nativeSessionId })
    }
    this.currentState = 'closed'
    this.emitter.emitClose('client closed')
  }

  onData(cb: (chunk: Uint8Array) => void): Unsubscribe {
    return this.emitter.onData(cb)
  }

  onClose(cb: (reason: string) => void): Unsubscribe {
    return this.emitter.onClose(cb)
  }

  private async tauri(): Promise<TauriCore> {
    return import('@tauri-apps/api/core') as Promise<TauriCore>
  }

  private wipePrivateKey(): void {
    if (this.options.auth?.kind === 'private-key') {
      this.options.auth.privateKeyPem.fill(0)
    }
  }
}
