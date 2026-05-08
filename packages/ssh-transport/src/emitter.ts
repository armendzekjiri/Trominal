import type { Unsubscribe } from './types'

export class TransportEmitter {
  private readonly dataListeners = new Set<(chunk: Uint8Array) => void>()
  private readonly closeListeners = new Set<(reason: string) => void>()

  onData(cb: (chunk: Uint8Array) => void): Unsubscribe {
    this.dataListeners.add(cb)
    return () => this.dataListeners.delete(cb)
  }

  onClose(cb: (reason: string) => void): Unsubscribe {
    this.closeListeners.add(cb)
    return () => this.closeListeners.delete(cb)
  }

  emitData(chunk: Uint8Array): void {
    for (const cb of this.dataListeners) {
      cb(chunk)
    }
  }

  emitClose(reason: string): void {
    for (const cb of this.closeListeners) {
      cb(reason)
    }
  }
}
