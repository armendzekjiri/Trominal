import type { Event } from '@tauri-apps/api/event'
import { TransportEmitter } from './emitter'
import type { SshConnectOptions, SshSession, SshSessionState, Unsubscribe } from './types'

type TauriCore = {
  invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>
}

type TauriEvent = {
  listen: <T>(event: string, handler: (event: Event<T>) => void) => Promise<() => void>
}

type SshData = {
  session_id: string
  data: number[]
}

type SshClosed = {
  session_id: string
  reason: string
}

export class NativeSshSession implements SshSession {
  readonly id: string
  private readonly emitter = new TransportEmitter()
  private currentState: SshSessionState = 'closed'
  private nativeSessionId: string | null = null
  private unlistenData: (() => void) | null = null
  private unlistenClosed: (() => void) | null = null

  constructor(private readonly options: SshConnectOptions) {
    this.id = crypto.randomUUID()
  }

  get state(): SshSessionState {
    return this.currentState
  }

  async connect(): Promise<void> {
    this.currentState = 'connecting'
    this.nativeSessionId = this.id
    const [{ invoke }, { listen }] = await Promise.all([this.tauriCore(), this.tauriEvent()])

    this.unlistenData = await listen<SshData>('ssh://data', (event) => {
      if (event.payload.session_id === this.nativeSessionId) {
        this.emitter.emitData(new Uint8Array(event.payload.data))
      }
    })
    this.unlistenClosed = await listen<SshClosed>('ssh://closed', (event) => {
      if (event.payload.session_id === this.nativeSessionId) {
        this.nativeSessionId = null
        this.currentState = 'closed'
        this.emitter.emitClose(event.payload.reason)
        this.cleanupListeners()
      }
    })

    try {
      await invoke<string>('ssh_connect', {
        request: {
          sessionId: this.id,
          host: this.options.host,
          port: this.options.port,
          username: this.options.username,
          cols: this.options.cols ?? 80,
          rows: this.options.rows ?? 24,
        },
      })
      this.currentState = 'connected'
    } catch (error) {
      this.nativeSessionId = null
      this.currentState = 'closed'
      this.cleanupListeners()
      throw error
    } finally {
      this.wipePrivateKey()
    }
  }

  write(data: Uint8Array): void {
    if (this.nativeSessionId === null) {
      return
    }

    void this.tauriCore().then(({ invoke }) =>
      invoke('ssh_write', { sessionId: this.nativeSessionId, data: Array.from(data) }),
    )
  }

  resize(cols: number, rows: number): void {
    if (this.nativeSessionId === null) {
      return
    }

    void this.tauriCore().then(({ invoke }) =>
      invoke('ssh_resize', { sessionId: this.nativeSessionId, cols, rows }),
    )
  }

  async close(): Promise<void> {
    this.wipePrivateKey()
    if (this.nativeSessionId !== null) {
      const { invoke } = await this.tauriCore()
      await invoke('ssh_close', { sessionId: this.nativeSessionId })
    }
    this.nativeSessionId = null
    this.currentState = 'closed'
    this.cleanupListeners()
    this.emitter.emitClose('client closed')
  }

  onData(cb: (chunk: Uint8Array) => void): Unsubscribe {
    return this.emitter.onData(cb)
  }

  onClose(cb: (reason: string) => void): Unsubscribe {
    return this.emitter.onClose(cb)
  }

  private async tauriCore(): Promise<TauriCore> {
    return import('@tauri-apps/api/core') as Promise<TauriCore>
  }

  private async tauriEvent(): Promise<TauriEvent> {
    return import('@tauri-apps/api/event') as Promise<TauriEvent>
  }

  private wipePrivateKey(): void {
    if (this.options.auth?.kind === 'private-key') {
      this.options.auth.privateKeyPem.fill(0)
    }
  }

  private cleanupListeners(): void {
    this.unlistenData?.()
    this.unlistenClosed?.()
    this.unlistenData = null
    this.unlistenClosed = null
  }
}
