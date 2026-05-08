import { ArrowDownUp, FolderPlus, RefreshCw, Server, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dot } from '@/components/ui/dot'
import { isTauri } from '@/lib/platform'
import { cn } from '@/lib/cn'
import { useHostCredentials, useHosts, useIdentities } from '@/features/vault/hooks'
import type { HostCredentialItem, HostItem, IdentityItem } from '@/features/vault/model'
import { authForHost } from '@/features/vault/ssh-auth'
import { EmptyPlaceholder } from '@/features/app/EmptyPlaceholder'
import { FilePane } from './FilePane'
import {
  sftpDownload,
  sftpList,
  sftpLocalHome,
  sftpLocalList,
  sftpMkdir,
  sftpRemove,
  sftpUpload,
} from './sftpApi'
import { summarizeTransfers, useTransfers } from './transfersStore'
import { useTransferEvents } from './useTransferEvents'
import type { SftpEntry, SftpHostArgs } from './types'

const REMOTE_ROOT = '/'

// Stable empty fallbacks keep the dependency arrays of the effects below
// referentially equal across renders.
const EMPTY_HOSTS: HostItem[] = []
const EMPTY_CREDENTIALS: HostCredentialItem[] = []
const EMPTY_IDENTITIES: IdentityItem[] = []

export function SftpPage() {
  if (!isTauri) {
    return (
      <EmptyPlaceholder
        title="SFTP — desktop only for v0.1"
        body="The web SFTP proxy will land alongside the wider browser SSH stack. For now, install the Trominal desktop app on macOS, Windows, or Linux to use the SFTP browser."
        hint="Your hosts and identities still sync, so a desktop session can pick up where you left off."
      />
    )
  }

  return <SftpPageDesktop />
}

function SftpPageDesktop() {
  useTransferEvents()

  const hostsQuery = useHosts()
  const credentialsQuery = useHostCredentials()
  const identitiesQuery = useIdentities()
  const transfers = useTransfers((s) => s.items)
  const enqueue = useTransfers((s) => s.enqueue)
  const markError = useTransfers((s) => s.markError)
  const removeTransfer = useTransfers((s) => s.remove)
  const summary = summarizeTransfers(transfers)

  const hosts = hostsQuery.data ?? EMPTY_HOSTS
  const credentials = credentialsQuery.data ?? EMPTY_CREDENTIALS
  const identities = identitiesQuery.data ?? EMPTY_IDENTITIES

  const [selectedHostId, setSelectedHostId] = useState<string | null>(null)
  const selectedHost = hosts.find((host) => host.id === selectedHostId) ?? null

  const [hostArgs, setHostArgs] = useState<SftpHostArgs | null>(null)
  const [hostError, setHostError] = useState<string | null>(null)
  const [resolvingHost, setResolvingHost] = useState(false)

  // Local pane state.
  const [localPath, setLocalPath] = useState('')
  const [localEntries, setLocalEntries] = useState<SftpEntry[]>([])
  const [localLoading, setLocalLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [localSelected, setLocalSelected] = useState<SftpEntry | null>(null)

  // Remote pane state.
  const [remotePath, setRemotePath] = useState(REMOTE_ROOT)
  const [remoteEntries, setRemoteEntries] = useState<SftpEntry[]>([])
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [remoteError, setRemoteError] = useState<string | null>(null)
  const [remoteSelected, setRemoteSelected] = useState<SftpEntry | null>(null)

  const [pageStatus, setPageStatus] = useState<string | null>(null)

  const hostLabel = useMemo(() => {
    if (selectedHost === null) return ''
    const username = selectedHost.username ? `${selectedHost.username}@` : ''
    return `${username}${selectedHost.hostname}`
  }, [selectedHost])

  useEffect(() => {
    let cancelled = false
    async function loadHome(): Promise<void> {
      try {
        setLocalLoading(true)
        const home = await sftpLocalHome()
        if (cancelled) return
        setLocalPath(home.path)
      } catch (err) {
        if (cancelled) return
        setLocalError(err instanceof Error ? err.message : 'Could not resolve home directory.')
      } finally {
        if (!cancelled) setLocalLoading(false)
      }
    }
    void loadHome()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (localPath === '') return
    let cancelled = false
    async function load(): Promise<void> {
      try {
        setLocalLoading(true)
        setLocalError(null)
        const result = await sftpLocalList(localPath)
        if (cancelled) return
        setLocalPath(result.path)
        setLocalEntries(result.entries)
      } catch (err) {
        if (cancelled) return
        setLocalError(err instanceof Error ? err.message : 'Could not list local directory.')
      } finally {
        if (!cancelled) setLocalLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [localPath])

  useEffect(() => {
    let cancelled = false
    async function resolveHost(): Promise<void> {
      if (selectedHost === null) {
        setHostArgs(null)
        return
      }
      setResolvingHost(true)
      setHostError(null)
      try {
        const auth = await authForHost(selectedHost, credentials, identities)
        if (cancelled) return
        if (auth?.kind !== 'private-key') {
          setHostArgs(null)
          setHostError('Attach an SSH identity to this host before using SFTP.')
          return
        }
        const args: SftpHostArgs = {
          host: selectedHost.hostname,
          port: parsePort(selectedHost.port),
          username: selectedHost.username,
          privateKeyPem: Array.from(auth.privateKeyPem),
        }
        // Wipe the original byte buffer once we've copied it for IPC.
        auth.privateKeyPem.fill(0)
        setHostArgs(args)
      } catch (err) {
        if (cancelled) return
        setHostError(err instanceof Error ? err.message : 'Could not resolve SSH identity.')
        setHostArgs(null)
      } finally {
        if (!cancelled) setResolvingHost(false)
      }
    }
    void resolveHost()
    return () => {
      cancelled = true
    }
  }, [selectedHost, credentials, identities])

  useEffect(() => {
    if (hostArgs === null) {
      // No active session — the right pane renders the "select host" stub
      // (see render branch below), so we don't need to mutate remote state.
      return
    }
    let cancelled = false
    async function loadRemote(): Promise<void> {
      try {
        setRemoteLoading(true)
        setRemoteError(null)
        const entries = await sftpList(hostArgs!, remotePath)
        if (cancelled) return
        setRemoteEntries(entries)
      } catch (err) {
        if (cancelled) return
        setRemoteError(err instanceof Error ? err.message : 'Could not list remote directory.')
      } finally {
        if (!cancelled) setRemoteLoading(false)
      }
    }
    void loadRemote()
    return () => {
      cancelled = true
    }
  }, [hostArgs, remotePath])

  function navigateLocal(entry: SftpEntry): void {
    if (entry.kind !== 'dir') return
    const next = joinPath(localPath, entry.name)
    setLocalSelected(null)
    setLocalPath(next)
  }

  function navigateRemote(entry: SftpEntry): void {
    if (entry.kind !== 'dir') return
    setRemoteSelected(null)
    setRemotePath(joinPath(remotePath, entry.name))
  }

  function upLocal(): void {
    setLocalSelected(null)
    setLocalPath(parentPath(localPath))
  }

  function upRemote(): void {
    setRemoteSelected(null)
    setRemotePath(parentPath(remotePath))
  }

  async function refreshLocal(): Promise<void> {
    if (localPath === '') return
    setLocalLoading(true)
    try {
      const result = await sftpLocalList(localPath)
      setLocalEntries(result.entries)
    } finally {
      setLocalLoading(false)
    }
  }

  async function refreshRemote(): Promise<void> {
    if (hostArgs === null) return
    setRemoteLoading(true)
    try {
      const entries = await sftpList(hostArgs, remotePath)
      setRemoteEntries(entries)
    } finally {
      setRemoteLoading(false)
    }
  }

  async function uploadEntry(entry: SftpEntry): Promise<void> {
    if (hostArgs === null || entry.kind !== 'file') return
    const local = joinPath(localPath, entry.name)
    const remote = joinPath(remotePath, entry.name)
    const id = makeTransferId()
    enqueue({
      id,
      direction: 'upload',
      name: entry.name,
      fromPath: local,
      toPath: remote,
      hostLabel,
    })
    try {
      await sftpUpload(id, hostArgs, local, remote)
      setPageStatus(`Uploading ${entry.name} to ${remote}…`)
    } catch (err) {
      markError(id, err instanceof Error ? err.message : 'Upload failed to start.')
    }
  }

  async function downloadEntry(entry: SftpEntry): Promise<void> {
    if (hostArgs === null || entry.kind !== 'file') return
    const remote = joinPath(remotePath, entry.name)
    const local = joinPath(localPath, entry.name)
    const id = makeTransferId()
    enqueue({
      id,
      direction: 'download',
      name: entry.name,
      fromPath: remote,
      toPath: local,
      hostLabel,
    })
    try {
      await sftpDownload(id, hostArgs, remote, local)
      setPageStatus(`Downloading ${entry.name} to ${local}…`)
    } catch (err) {
      markError(id, err instanceof Error ? err.message : 'Download failed to start.')
    }
  }

  async function newRemoteFolder(): Promise<void> {
    if (hostArgs === null) return
    const name = window.prompt('New folder name')
    if (name === null || name.trim() === '') return
    try {
      await sftpMkdir(hostArgs, joinPath(remotePath, name.trim()))
      await refreshRemote()
      setPageStatus(`Created ${name.trim()}.`)
    } catch (err) {
      setPageStatus(err instanceof Error ? err.message : 'mkdir failed.')
    }
  }

  async function deleteRemoteSelection(): Promise<void> {
    if (hostArgs === null || remoteSelected === null) return
    if (!window.confirm(`Delete ${remoteSelected.name}? This cannot be undone.`)) {
      return
    }
    try {
      await sftpRemove(
        hostArgs,
        joinPath(remotePath, remoteSelected.name),
        remoteSelected.kind === 'dir',
      )
      setRemoteSelected(null)
      await refreshRemote()
      setPageStatus(`Deleted ${remoteSelected.name}.`)
    } catch (err) {
      setPageStatus(err instanceof Error ? err.message : 'Delete failed.')
    }
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto] bg-bg">
      <header className="flex items-center gap-3 border-b border-border bg-bg-elev px-4 py-2">
        <ArrowDownUp size={15} className="text-accent" />
        <div className="flex flex-col">
          <span className="text-[14px] font-medium">SFTP</span>
          <span className="font-mono text-[11px] text-fg-faint">
            {summary.active} active · {summary.pending} queued · {summary.done} done ·{' '}
            {summary.failed} failed
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <HostPicker
            hosts={hosts}
            selectedHostId={selectedHostId}
            onChange={(id) => {
              setSelectedHostId(id)
              setRemotePath(REMOTE_ROOT)
              setRemoteSelected(null)
            }}
            connected={hostArgs !== null}
            label={hostLabel}
            resolving={resolvingHost}
            error={hostError}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={hostArgs === null || localSelected === null || localSelected.kind !== 'file'}
            onClick={() => localSelected !== null && void uploadEntry(localSelected)}
          >
            <Upload size={13} />
            Upload
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={hostArgs === null}
            onClick={() => void newRemoteFolder()}
          >
            <FolderPlus size={13} />
            New folder
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={hostArgs === null || remoteSelected === null}
            onClick={() => void deleteRemoteSelection()}
          >
            <Trash2 size={13} />
            Delete
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void refreshRemote()}
            disabled={hostArgs === null}
          >
            <RefreshCw size={13} />
            Refresh
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)]">
        <FilePane
          side="local"
          title={selectedHost?.name ?? 'Local files'}
          path={localPath}
          entries={localEntries}
          isLoading={localLoading}
          error={localError}
          onRefresh={() => void refreshLocal()}
          onNavigate={navigateLocal}
          onUpDirectory={upLocal}
          onSelect={setLocalSelected}
          selected={localSelected}
          onTransfer={(entry) => void uploadEntry(entry)}
          transferLabel="Upload →"
          emptyMessage="No files in this directory"
        />
        <div className="bg-border" aria-hidden />
        {hostArgs === null ? (
          <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-bg-elev px-6 text-center">
            <div className="flex max-w-sm flex-col items-center gap-3 text-[12px] text-fg-muted">
              <Server size={20} className="text-fg-faint" />
              <p>Select a host with an attached SSH identity to start an SFTP session.</p>
              {hostError !== null && <p className="text-danger">{hostError}</p>}
            </div>
          </div>
        ) : (
          <FilePane
            side="remote"
            title={hostLabel}
            path={remotePath}
            entries={remoteEntries}
            isLoading={remoteLoading}
            error={remoteError}
            onRefresh={() => void refreshRemote()}
            onNavigate={navigateRemote}
            onUpDirectory={upRemote}
            onSelect={setRemoteSelected}
            selected={remoteSelected}
            onTransfer={(entry) => void downloadEntry(entry)}
            transferLabel="← Download"
            emptyMessage="No files at this remote path"
          />
        )}
      </div>

      <footer className="flex flex-col gap-2 border-t border-border bg-bg-elev px-4 py-2">
        <div className="flex items-center gap-2 text-[12px]">
          <ArrowDownUp size={13} className="text-fg-muted" />
          <span className="font-medium text-fg">Transfers</span>
          <span className="font-mono text-[11px] text-fg-faint">
            {summary.active + summary.pending} in flight · {summary.done} done · {summary.failed}{' '}
            failed
          </span>
          {pageStatus !== null && (
            <span className="ml-2 truncate font-mono text-[11px] text-fg-faint">{pageStatus}</span>
          )}
        </div>
        <ul className="grid max-h-32 gap-1 overflow-auto text-[12px]">
          {transfers.length === 0 && (
            <li className="text-[11px] text-fg-faint">
              Drag a file or use the Upload / Download buttons to start a transfer.
            </li>
          )}
          {transfers.map((t) => (
            <li
              key={t.id}
              className={cn(
                'grid grid-cols-[18px_minmax(0,1fr)_minmax(0,2fr)_minmax(60px,80px)_24px] items-center gap-3',
              )}
            >
              <span
                className={cn(
                  t.status === 'done'
                    ? 'text-accent'
                    : t.status === 'error' || t.status === 'cancelled'
                      ? 'text-danger'
                      : 'text-fg-muted',
                )}
              >
                {t.status === 'done' ? '✓' : t.direction === 'upload' ? '↑' : '↓'}
              </span>
              <span className="truncate font-mono">{t.name}</span>
              <span className="truncate font-mono text-[11px] text-fg-faint">
                {t.fromPath} → {t.toPath}
              </span>
              <span className="truncate text-right font-mono text-[11px] text-fg-faint">
                {transferStatusLabel(t.status, t.errorMessage)}
              </span>
              <button
                type="button"
                onClick={() => removeTransfer(t.id)}
                className="text-fg-faint hover:text-fg"
                aria-label="Remove transfer from list"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </footer>
    </div>
  )
}

function HostPicker({
  hosts,
  selectedHostId,
  onChange,
  connected,
  label,
  resolving,
  error,
}: {
  hosts: HostItem[]
  selectedHostId: string | null
  onChange: (id: string | null) => void
  connected: boolean
  label: string
  resolving: boolean
  error: string | null
}) {
  return (
    <label
      className={cn(
        'flex h-8 items-center gap-2 rounded-md border bg-surface px-2 font-mono text-[11px]',
        error !== null
          ? 'border-danger text-danger'
          : connected
            ? 'border-accent-ring text-fg'
            : 'border-border-strong text-fg-muted',
      )}
    >
      <Dot
        state={
          connected
            ? 'connected'
            : resolving
              ? 'connecting'
              : error !== null
                ? 'disconnected'
                : 'idle'
        }
        size={6}
      />
      <select
        value={selectedHostId ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
        className="appearance-none border-0 bg-transparent pr-2 text-[11px] outline-none"
      >
        <option value="">Select host</option>
        {hosts.map((host) => (
          <option key={host.id} value={host.id}>
            {host.name || host.hostname}
          </option>
        ))}
      </select>
      {connected && <span className="ml-auto truncate text-fg">{label}</span>}
    </label>
  )
}

function transferStatusLabel(status: string, errorMessage: string | null): string {
  switch (status) {
    case 'pending':
      return 'queued'
    case 'active':
      return 'transferring'
    case 'done':
      return 'done'
    case 'error':
      return errorMessage ? errorMessage.slice(0, 60) : 'error'
    case 'cancelled':
      return 'cancelled'
    default:
      return status
  }
}

function joinPath(base: string, name: string): string {
  if (name === '..') return parentPath(base)
  if (name === '.' || name === '') return base
  if (base === '' || base === '/') return `/${name.replace(/^\/+/, '')}`
  if (base.endsWith('/')) return `${base}${name}`
  return `${base}/${name}`
}

function parentPath(path: string): string {
  if (path === '' || path === '/') return '/'
  const stripped = path.replace(/\/+$/, '')
  const idx = stripped.lastIndexOf('/')
  if (idx <= 0) return '/'
  return stripped.slice(0, idx) || '/'
}

function parsePort(value: string): number {
  const match = /^\s*(\d+)\s*$/.exec(value)
  if (match === null) return 22
  const parsed = Number.parseInt(match[1] ?? '22', 10)
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 65535 ? parsed : 22
}

function makeTransferId(): string {
  return `xfer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
