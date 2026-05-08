import { invoke } from '@tauri-apps/api/core'
import type {
  SftpEntry,
  SftpHostArgs,
  SftpListResponse,
  SftpLocalHomeResponse,
  SftpLocalListResponse,
  SftpRemoteHomeResponse,
  SftpTransferStartResponse,
} from './types'

/**
 * Thin typed wrappers around the Tauri commands in
 * apps/client/src-tauri/src/sftp.rs. Each function maps 1:1 to a backend
 * command — keeping React components free of `invoke()` strings makes the
 * surface refactorable later (e.g. switch to a long-lived sftp PTY session)
 * without grepping the codebase.
 */
export async function sftpList(host: SftpHostArgs, remotePath: string): Promise<SftpEntry[]> {
  const response = await invoke<SftpListResponse>('sftp_list', {
    request: { host, remotePath },
  })
  return response.entries
}

export async function sftpMkdir(host: SftpHostArgs, remotePath: string): Promise<void> {
  await invoke<void>('sftp_mkdir', { request: { host, remotePath } })
}

export async function sftpRemove(
  host: SftpHostArgs,
  remotePath: string,
  isDir: boolean,
): Promise<void> {
  await invoke<void>('sftp_remove', { request: { host, remotePath, isDir } })
}

export async function sftpRename(
  host: SftpHostArgs,
  fromPath: string,
  toPath: string,
): Promise<void> {
  await invoke<void>('sftp_rename', { request: { host, fromPath, toPath } })
}

export async function sftpUpload(
  transferId: string,
  host: SftpHostArgs,
  localPath: string,
  remotePath: string,
): Promise<string> {
  const response = await invoke<SftpTransferStartResponse>('sftp_upload', {
    request: { transferId, host, localPath, remotePath },
  })
  return response.transferId
}

export async function sftpDownload(
  transferId: string,
  host: SftpHostArgs,
  remotePath: string,
  localPath: string,
): Promise<string> {
  const response = await invoke<SftpTransferStartResponse>('sftp_download', {
    request: { transferId, host, remotePath, localPath },
  })
  return response.transferId
}

export async function sftpCancel(transferId: string): Promise<void> {
  await invoke<void>('sftp_cancel', { transferId })
}

export async function sftpLocalList(path: string): Promise<SftpLocalListResponse> {
  return invoke<SftpLocalListResponse>('sftp_local_list', { request: { path } })
}

export async function sftpLocalHome(): Promise<SftpLocalHomeResponse> {
  return invoke<SftpLocalHomeResponse>('sftp_local_home')
}

export async function sftpRemoteHome(host: SftpHostArgs): Promise<SftpRemoteHomeResponse> {
  return invoke<SftpRemoteHomeResponse>('sftp_remote_home', { request: { host } })
}
