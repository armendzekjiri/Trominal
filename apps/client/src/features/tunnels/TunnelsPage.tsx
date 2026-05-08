import {
  ArrowDownUp,
  CircleStop,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  Workflow,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { cn } from '@/lib/cn'
import { isTauri } from '@/lib/platform'
import {
  useDeleteTunnel,
  useHostCredentials,
  useHosts,
  useIdentities,
  useSaveTunnel,
  useTunnels,
} from '@/features/vault/hooks'
import {
  defaultTunnelConfig,
  type TunnelConfig,
  type TunnelInput,
  type TunnelItem,
  type TunnelKind,
} from '@/features/vault/model'
import { authForHost } from '@/features/vault/ssh-auth'

type TauriCore = {
  invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>
}

type TunnelRuntime = {
  sessionId: string
  status: 'running' | 'starting' | 'stopping'
}

type SshTunnelOpenResponse = {
  sessionId: string
}

type SshTunnelStatusResponse = {
  running: boolean
}

const EMPTY_TUNNEL: TunnelInput = {
  hostId: null,
  name: '',
  config: defaultTunnelConfig(),
  enabled: false,
}

const EMPTY_TUNNELS: TunnelItem[] = []

const KIND_LABEL: Record<TunnelKind, string> = {
  local: 'Local',
  remote: 'Remote',
  socks: 'SOCKS',
}

function tunnelToInput(tunnel: TunnelItem): TunnelInput {
  return {
    id: tunnel.id,
    hostId: tunnel.hostId,
    name: tunnel.name,
    config: tunnel.config,
    enabled: tunnel.enabled,
  }
}

export function TunnelsPage() {
  const tunnelsQuery = useTunnels()
  const hostsQuery = useHosts()
  const credentialsQuery = useHostCredentials()
  const identitiesQuery = useIdentities()
  const saveTunnel = useSaveTunnel()
  const deleteTunnel = useDeleteTunnel()
  const tunnels = tunnelsQuery.data ?? EMPTY_TUNNELS
  const hosts = hostsQuery.data ?? []
  const credentials = credentialsQuery.data ?? []
  const identities = identitiesQuery.data ?? []
  const [draft, setDraft] = useState<TunnelInput>(EMPTY_TUNNEL)
  const [runtime, setRuntime] = useState<Record<string, TunnelRuntime>>({})
  const [status, setStatus] = useState<string | null>(null)

  const selectedTunnel =
    draft.id === undefined ? null : (tunnels.find((tunnel) => tunnel.id === draft.id) ?? null)
  const selectedHost = hosts.find((host) => host.id === draft.hostId) ?? null
  const activeCount = Object.values(runtime).filter((item) => item.status === 'running').length

  useEffect(() => {
    if (!isTauri || tunnels.length === 0) {
      return
    }

    let cancelled = false
    async function syncNativeTunnelStatus(): Promise<void> {
      let entries: Array<[string, TunnelRuntime | null]>
      try {
        const { invoke } = await tauriCore()
        entries = await Promise.all(
          tunnels.map(async (tunnel): Promise<[string, TunnelRuntime | null]> => {
            const sessionId = tunnelSessionId(tunnel.id)
            const response = await invoke<SshTunnelStatusResponse>('ssh_tunnel_status', {
              sessionId,
            })
            return [tunnel.id, response.running ? { sessionId, status: 'running' } : null]
          }),
        )
      } catch {
        return
      }
      if (cancelled) {
        return
      }

      setRuntime((current) => {
        const next = { ...current }
        for (const [tunnelId, item] of entries) {
          if (item === null) {
            delete next[tunnelId]
          } else {
            next[tunnelId] = item
          }
        }
        return next
      })
    }

    void syncNativeTunnelStatus()
    return () => {
      cancelled = true
    }
  }, [tunnels])

  async function submitTunnel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus(null)
    const input = normalizedDraft(draft)
    const validation = validateTunnel(input)
    if (validation !== null) {
      setStatus(validation)
      return
    }
    const saved = await saveTunnel.mutateAsync(input)
    setDraft({
      ...input,
      id: String(saved.id),
    })
    setStatus('Tunnel saved.')
  }

  async function removeTunnel(): Promise<void> {
    if (draft.id === undefined) {
      return
    }
    if (runtime[draft.id] !== undefined) {
      await stopTunnel(draft.id)
    }
    await deleteTunnel.mutateAsync(draft.id)
    setDraft(EMPTY_TUNNEL)
    setStatus('Tunnel deleted.')
  }

  async function startTunnel(tunnel: TunnelItem): Promise<void> {
    const validation = validateTunnel(tunnelToInput(tunnel))
    if (validation !== null) {
      setStatus(validation)
      return
    }
    const host = hosts.find((item) => item.id === tunnel.hostId)
    if (host === undefined) {
      setStatus('Select a host before starting the tunnel.')
      return
    }
    if (!isTauri) {
      setStatus('Web tunnel proxy is not enabled in this build.')
      return
    }

    const existing = runtime[tunnel.id]
    if (existing !== undefined) {
      return
    }

    setRuntime((current) => ({
      ...current,
      [tunnel.id]: { sessionId: '', status: 'starting' },
    }))
    setStatus(`Starting ${tunnel.name || KIND_LABEL[tunnel.config.kind]}...`)

    const auth = await authForHost(host, credentials, identities)
    if (auth?.kind !== 'private-key') {
      setRuntime((current) => removeRuntime(current, tunnel.id))
      setStatus('Attach an SSH identity to this host before starting a tunnel.')
      return
    }

    try {
      const sessionId = tunnelSessionId(tunnel.id)
      const { invoke } = await tauriCore()
      const response = await invoke<SshTunnelOpenResponse>('ssh_tunnel_open', {
        request: {
          sessionId,
          host: host.hostname,
          port: sshPort(host.port),
          username: host.username,
          privateKeyPem: Array.from(auth.privateKeyPem),
          tunnel: nativeTunnelSpec(tunnel.config),
        },
      })
      setRuntime((current) => ({
        ...current,
        [tunnel.id]: { sessionId: response.sessionId, status: 'running' },
      }))
      setStatus(`${tunnel.name || KIND_LABEL[tunnel.config.kind]} is running.`)
    } catch (error) {
      setRuntime((current) => removeRuntime(current, tunnel.id))
      setStatus(error instanceof Error ? error.message : 'Tunnel failed to start.')
    } finally {
      auth.privateKeyPem.fill(0)
    }
  }

  async function stopTunnel(tunnelId: string): Promise<void> {
    const running = runtime[tunnelId]
    if (running === undefined || running.sessionId === '') {
      setRuntime((current) => removeRuntime(current, tunnelId))
      return
    }

    setRuntime((current) => ({
      ...current,
      [tunnelId]: { ...running, status: 'stopping' },
    }))
    try {
      const { invoke } = await tauriCore()
      await invoke('ssh_tunnel_close', { sessionId: running.sessionId })
      setStatus('Tunnel stopped.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Tunnel failed to stop.')
    } finally {
      setRuntime((current) => removeRuntime(current, tunnelId))
    }
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_360px] bg-bg">
      <section className="flex min-h-0 flex-col">
        <div className="flex h-12 items-center gap-3 border-b border-border px-4">
          <Workflow size={16} className="text-accent" />
          <div>
            <div className="text-[14px] font-medium">Tunnels</div>
            <div className="font-mono text-[11px] text-fg-faint">
              {activeCount} active · {tunnels.length - activeCount} saved
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void tunnelsQuery.refetch()}>
              <RefreshCw size={13} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setDraft(EMPTY_TUNNEL)}>
              <Plus size={13} />
              New tunnel
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="overflow-hidden rounded-md border border-border bg-surface">
            <div className="grid grid-cols-[96px_minmax(140px,1fr)_minmax(160px,1.2fr)_180px_84px_92px] border-b border-border px-3 py-2 text-[11px] uppercase tracking-wide text-fg-faint">
              <span>Type</span>
              <span>Bind</span>
              <span>Target</span>
              <span>Via host</span>
              <span>Auto</span>
              <span>State</span>
            </div>
            {tunnelsQuery.isLoading ? (
              <div className="flex items-center gap-2 px-3 py-4 text-[12px] text-fg-faint">
                <Loader2 size={13} className="animate-spin" />
                Loading tunnels
              </div>
            ) : tunnels.length === 0 ? (
              <div className="px-3 py-4 text-[12px] text-fg-faint">No tunnels saved.</div>
            ) : (
              tunnels.map((tunnel) => {
                const host = hosts.find((item) => item.id === tunnel.hostId)
                const state = runtime[tunnel.id]?.status ?? 'idle'
                return (
                  <button
                    key={tunnel.id}
                    type="button"
                    onClick={() => setDraft(tunnelToInput(tunnel))}
                    className={cn(
                      'grid w-full grid-cols-[96px_minmax(140px,1fr)_minmax(160px,1.2fr)_180px_84px_92px] items-center border-b border-border-subtle px-3 py-3 text-left text-[12px] last:border-b-0 hover:bg-surface-2',
                      selectedTunnel?.id === tunnel.id ? 'bg-surface-3' : '',
                    )}
                  >
                    <span className="font-mono text-accent">{KIND_LABEL[tunnel.config.kind]}</span>
                    <span className="truncate font-mono text-fg">{bindLabel(tunnel.config)}</span>
                    <span className="truncate font-mono text-fg-muted">
                      {targetLabel(tunnel.config)}
                    </span>
                    <span className="flex min-w-0 items-center gap-2 truncate font-mono text-fg-muted">
                      <Server size={12} className="shrink-0 text-fg-faint" />
                      <span className="truncate">{host?.name || host?.hostname || 'No host'}</span>
                    </span>
                    <span className="font-mono text-fg-faint">{tunnel.enabled ? 'on' : 'off'}</span>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          state === 'running' ? 'bg-accent' : 'bg-fg-faint',
                        )}
                      />
                      <span className="font-mono text-fg-faint">{state}</span>
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </section>

      <aside className="min-h-0 overflow-auto border-l border-border bg-bg-elev p-4">
        <form onSubmit={(event) => void submitTunnel(event)} className="grid gap-4">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <ArrowDownUp size={15} className="text-accent" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-medium">
                {draft.id === undefined ? 'New tunnel' : draft.name}
              </div>
              <div className="font-mono text-[11px] text-fg-faint">
                {KIND_LABEL[draft.config.kind]}
              </div>
            </div>
          </div>

          <TextInput
            label="Name"
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder="prod postgres"
            required
          />

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-fg-muted">
              Via host
            </span>
            <select
              value={draft.hostId ?? ''}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  hostId: event.target.value === '' ? null : event.target.value,
                })
              }
              className="h-10 rounded-md border border-border-strong bg-surface px-3 text-[13px] outline-none focus:border-accent"
              required
            >
              <option value="">Select host</option>
              {hosts.map((host) => (
                <option key={host.id} value={host.id}>
                  {host.name || host.hostname}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-fg-muted">
              Type
            </span>
            <select
              value={draft.config.kind}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  config: {
                    ...draft.config,
                    kind: event.target.value as TunnelKind,
                  },
                })
              }
              className="h-10 rounded-md border border-border-strong bg-surface px-3 text-[13px] outline-none focus:border-accent"
            >
              <option value="local">Local</option>
              <option value="remote">Remote</option>
              <option value="socks">SOCKS</option>
            </select>
          </label>

          <div className="grid grid-cols-[1fr_96px] gap-3">
            <TextInput
              label="Bind host"
              value={draft.config.bindHost}
              onChange={(event) => setConfig(draft, setDraft, { bindHost: event.target.value })}
              placeholder="127.0.0.1"
              mono
            />
            <TextInput
              label="Bind port"
              value={draft.config.bindPort}
              onChange={(event) => setConfig(draft, setDraft, { bindPort: event.target.value })}
              placeholder="15432"
              mono
              required
            />
          </div>

          {draft.config.kind !== 'socks' && (
            <div className="grid grid-cols-[1fr_96px] gap-3">
              <TextInput
                label="Target host"
                value={draft.config.targetHost}
                onChange={(event) => setConfig(draft, setDraft, { targetHost: event.target.value })}
                placeholder={draft.config.kind === 'local' ? 'db.internal' : 'localhost'}
                mono
                required
              />
              <TextInput
                label="Target port"
                value={draft.config.targetPort}
                onChange={(event) => setConfig(draft, setDraft, { targetPort: event.target.value })}
                placeholder={draft.config.kind === 'local' ? '5432' : '9000'}
                mono
                required
              />
            </div>
          )}

          <label className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-fg-muted">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Auto
          </label>

          {status !== null && (
            <div className="rounded-md border border-border-subtle bg-surface p-2 text-[11px] text-fg-muted">
              {status}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button disabled={saveTunnel.isPending}>
              {saveTunnel.isPending ? <Loader2 size={13} className="animate-spin" /> : null}
              Save tunnel
            </Button>
            {selectedTunnel !== null && (
              <>
                {runtime[selectedTunnel.id] === undefined ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void startTunnel(selectedTunnel)}
                  >
                    <Play size={13} />
                    Start
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void stopTunnel(selectedTunnel.id)}
                  >
                    <CircleStop size={13} />
                    Stop
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={() => void removeTunnel()}>
                  <Trash2 size={13} />
                  Delete
                </Button>
              </>
            )}
          </div>

          {selectedHost !== null && (
            <div className="border-t border-border pt-3 text-[11px] leading-5 text-fg-faint">
              <div className="font-mono text-fg-muted">
                {selectedHost.username ? `${selectedHost.username}@` : ''}
                {selectedHost.hostname}:{selectedHost.port || '22'}
              </div>
            </div>
          )}
        </form>
      </aside>
    </div>
  )
}

function normalizedDraft(input: TunnelInput): TunnelInput {
  return {
    ...input,
    name: input.name.trim(),
    config: {
      kind: input.config.kind,
      bindHost: input.config.bindHost.trim() || '127.0.0.1',
      bindPort: input.config.bindPort.trim(),
      targetHost: input.config.kind === 'socks' ? '' : input.config.targetHost.trim(),
      targetPort: input.config.kind === 'socks' ? '' : input.config.targetPort.trim(),
    },
  }
}

function validateTunnel(input: TunnelInput): string | null {
  if (input.hostId === null) {
    return 'Select a host before saving the tunnel.'
  }
  if (input.name.trim() === '') {
    return 'Tunnel name is required.'
  }
  if (!isValidPort(input.config.bindPort)) {
    return 'Bind port must be between 1 and 65535.'
  }
  if (input.config.kind !== 'socks') {
    if (input.config.targetHost.trim() === '') {
      return 'Target host is required.'
    }
    if (!isValidPort(input.config.targetPort)) {
      return 'Target port must be between 1 and 65535.'
    }
  }

  return null
}

function setConfig(
  draft: TunnelInput,
  setDraft: (value: TunnelInput) => void,
  patch: Partial<TunnelConfig>,
): void {
  setDraft({
    ...draft,
    config: {
      ...draft.config,
      ...patch,
    },
  })
}

function bindLabel(config: TunnelConfig): string {
  return `${config.bindHost || '127.0.0.1'}:${config.bindPort || '-'}`
}

function targetLabel(config: TunnelConfig): string {
  if (config.kind === 'socks') {
    return 'SOCKS5'
  }

  return `${config.targetHost || '-'}:${config.targetPort || '-'}`
}

function nativeTunnelSpec(config: TunnelConfig): Record<string, string | number> {
  if (config.kind === 'socks') {
    return {
      kind: 'socks',
      bindHost: config.bindHost || '127.0.0.1',
      bindPort: portNumber(config.bindPort),
    }
  }

  return {
    kind: config.kind,
    bindHost: config.bindHost || '127.0.0.1',
    bindPort: portNumber(config.bindPort),
    targetHost: config.targetHost,
    targetPort: portNumber(config.targetPort),
  }
}

function removeRuntime(
  current: Record<string, TunnelRuntime>,
  tunnelId: string,
): Record<string, TunnelRuntime> {
  const next = { ...current }
  delete next[tunnelId]
  return next
}

function tunnelSessionId(tunnelId: string): string {
  return `tunnel-${tunnelId}`
}

function sshPort(value: string): number {
  const parsed = portNumber(value || '22')
  return parsed === 0 ? 22 : parsed
}

function portNumber(value: string): number {
  if (!/^\d+$/.test(value.trim())) {
    return 0
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 65535 ? parsed : 0
}

function isValidPort(value: string): boolean {
  return portNumber(value) !== 0
}

async function tauriCore(): Promise<TauriCore> {
  return import('@tauri-apps/api/core') as Promise<TauriCore>
}
