/** Mirrors the `SftpEntry` Rust struct in apps/client/src-tauri/src/sftp.rs. */
export type SftpEntry = {
  name: string
  kind: 'file' | 'dir' | 'symlink' | 'other'
  size: number
  modified: string
  permissions: string
}

export type SftpHostArgs = {
  host: string
  port: number
  username: string
  /** PEM bytes of the attached private key — derived via authForHost(). */
  privateKeyPem: number[]
}

export type SftpListResponse = { entries: SftpEntry[] }
export type SftpLocalListResponse = { path: string; entries: SftpEntry[] }
export type SftpLocalHomeResponse = { path: string }

export type SftpTransferStartResponse = { transferId: string }

/** Shape emitted on `sftp://transfer` from the Rust monitor thread. */
export type SftpTransferEvent = {
  transferId: string
  state: 'started' | 'done' | 'error'
  message: string | null
}
