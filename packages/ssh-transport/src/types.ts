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

export type SshConnectOptions = {
  hostId?: string
  host: string
  port: number
  username: string
  auth?: SshAuth
  websocketUrl?: string
  /** Single-use web SSH token; sent in the first WebSocket frame, never in the URL. */
  websocketToken?: string
  /**
   * Pinned server host key, OpenSSH format (`SHA256:<base64>`), from the
   * user's encrypted vault. Required for web SSH: the proxy verifies it before
   * sending any credential and refuses to connect without it.
   */
  hostKeyFingerprint?: string
  cols?: number
  rows?: number
  sessionName?: string
}

/** Host key presented by a server, as reported by a web SSH probe or mismatch. */
export type WebSshHostKey = {
  /** OpenSSH SHA-256 fingerprint, e.g. `SHA256:OvoVOrZk…`. */
  fingerprint: string
  /** SSH key algorithm, e.g. `ssh-ed25519`. */
  keyType: string
}

/** First-use probe: fetch the presented host key without authenticating. */
export type WebSshProbeOptions = {
  websocketUrl: string
  websocketToken: string
  hostId: string
  host: string
  port: number
}

export type WebSshErrorCode =
  | 'invalid_frame'
  | 'invalid_token'
  | 'web_ssh_disabled'
  | 'destination_mismatch'
  | 'destination_unresolvable'
  | 'destination_denied'
  | 'connect_failed'
  | 'host_key_unknown'
  | 'host_key_mismatch'
  | 'host_key_unavailable'
  | 'auth_failed'
  | 'session_failed'
  | 'channel_closed'

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
