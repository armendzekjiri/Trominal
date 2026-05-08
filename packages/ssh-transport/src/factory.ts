import { LocalShellSession } from './local-shell-transport'
import { NativeSshSession } from './native-transport'
import { WebSocketSshSession } from './websocket-transport'
import type { LocalShellOptions, SshConnectOptions, SshSession } from './types'

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function createSshSession(options: SshConnectOptions): SshSession {
  if (isTauriRuntime()) {
    return new NativeSshSession(options)
  }

  return new WebSocketSshSession(options)
}

export function createLocalShellSession(options?: LocalShellOptions): SshSession {
  if (!isTauriRuntime()) {
    throw new Error('Local shell sessions require the desktop app.')
  }

  return new LocalShellSession(options)
}
