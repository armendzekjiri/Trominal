export type Unsubscribe = () => void

export type SshAuth =
  | {
      kind: 'password'
      password: string
    }
  | {
      kind: 'private-key'
      privateKeyPem: Uint8Array
      publicKey?: string
      passphrase?: string
    }

/** An approved SSH host key (desktop transport only). */
export type SshHostKeyPin = {
  keyType: string
  publicKey: string
}

export type SshConnectOptions = {
  hostId?: string
  /**
   * Host keys the user approved for this host. The desktop transport refuses
   * to connect to a server that presents none of them.
   */
  hostKeys?: SshHostKeyPin[]
  host: string
  port: number
  username: string
  auth?: SshAuth
  websocketUrl?: string
  cols?: number
  rows?: number
  sessionName?: string
}

export type LocalShellOptions = {
  cols?: number
  rows?: number
  sessionName?: string
}

export type SshSessionState = 'closed' | 'connected' | 'connecting'

export interface SshSession {
  readonly id: string
  readonly state: SshSessionState
  connect(): Promise<void>
  write(data: Uint8Array): void
  resize(cols: number, rows: number): void
  close(): Promise<void>
  onData(cb: (chunk: Uint8Array) => void): Unsubscribe
  onClose(cb: (reason: string) => void): Unsubscribe
}
