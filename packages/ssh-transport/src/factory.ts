import { NativeSshSession } from './native-transport'
import { WebSocketSshSession } from './websocket-transport'
import type { SshConnectOptions, SshSession } from './types'

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function createSshSession(options: SshConnectOptions): SshSession {
  if (isTauriRuntime()) {
    return new NativeSshSession(options)
  }

  return new WebSocketSshSession(options)
}
