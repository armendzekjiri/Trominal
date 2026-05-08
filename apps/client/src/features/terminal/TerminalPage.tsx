import { createLocalShellSession, createSshSession, type SshSession } from '@trominal/ssh-transport'
import type { Terminal } from '@xterm/xterm'
import {
  Laptop,
  Loader2,
  Plus,
  Power,
  RotateCcw,
  Server,
  Sparkles,
  SplitSquareHorizontal,
  X,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Dot } from '@/components/ui/dot'
import { getApiClient } from '@/lib/api-client'
import { cn } from '@/lib/cn'
import { isTauri } from '@/lib/platform'
import { useAuth } from '@/stores/auth'
import { useHostCredentials, useHosts, useIdentities } from '@/features/vault/hooks'
import type { HostItem } from '@/features/vault/model'
import { authForHost } from '@/features/vault/ssh-auth'
import { AskAiPanel } from '@/features/ai/AskAiPanel'
import { XtermPane } from './XtermPane'

type BaseTerminalTab = {
  id: string
  status: 'closed' | 'connected' | 'connecting'
  session: SshSession | null
}

type TerminalTab =
  | (BaseTerminalTab & {
      kind: 'host'
      host: HostItem
    })
  | (BaseTerminalTab & {
      kind: 'local'
      title: string
    })

function statusToDot(status: TerminalTab['status']) {
  if (status === 'connected') {
    return 'connected'
  }
  if (status === 'connecting') {
    return 'connecting'
  }
  return 'disconnected'
}

export function TerminalPage() {
  if (!isTauri) {
    return <WebTerminalUnavailable />
  }

  return <DesktopTerminalPage />
}

function tabTitle(tab: TerminalTab): string {
  return tab.kind === 'local' ? tab.title : tab.host.name || tab.host.hostname
}

function WebTerminalUnavailable() {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-bg">
      <div className="max-w-sm text-center">
        <div className="mb-3 text-[14px] font-medium">Terminal is desktop-only in v0.1</div>
        <div className="text-[12px] text-fg-faint">Web terminal support is deferred.</div>
      </div>
    </div>
  )
}

function DesktopTerminalPage() {
  const [searchParams] = useSearchParams()
  const hostsQuery = useHosts()
  const hostCredentialsQuery = useHostCredentials()
  const identitiesQuery = useIdentities()
  const hosts = hostsQuery.data ?? []
  const hostCredentials = hostCredentialsQuery.data ?? []
  const identities = identitiesQuery.data ?? []
  const requestedHost =
    hosts.find((host) => host.id === searchParams.get('host')) ?? hosts[0] ?? null
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0] ?? null
  const [askAiOpen, setAskAiOpen] = useState(false)
  const terminalRef = useRef<Terminal | null>(null)
  const canUseAi = useAuth((s) => s.hasPermission('ai.use'))

  function addHostTab(host: HostItem): void {
    const id = crypto.randomUUID()
    setTabs((current) => [
      ...current,
      {
        id,
        kind: 'host',
        host,
        status: 'closed',
        session: null,
      },
    ])
    setActiveId(id)
  }

  function addLocalTab(): void {
    const id = crypto.randomUUID()
    setTabs((current) => [
      ...current,
      {
        id,
        kind: 'local',
        title: 'Local shell',
        status: 'closed',
        session: null,
      },
    ])
    setActiveId(id)
  }

  async function connect(tab: TerminalTab): Promise<void> {
    setTabs((current) =>
      current.map((item) => (item.id === tab.id ? { ...item, status: 'connecting' } : item)),
    )
    try {
      const session =
        tab.kind === 'local'
          ? createLocalShellSession({ sessionName: tab.title })
          : await hostSession(tab.host)
      setTabs((current) =>
        current.map((item) => (item.id === tab.id ? { ...item, session } : item)),
      )
      await session.connect()
      setTabs((current) =>
        current.map((item) =>
          item.id === tab.id ? { ...item, status: 'connected', session } : item,
        ),
      )
    } catch {
      setTabs((current) =>
        current.map((item) =>
          item.id === tab.id ? { ...item, status: 'closed', session: null } : item,
        ),
      )
    }
  }

  async function hostSession(host: HostItem): Promise<SshSession> {
    const auth = await authForHost(host, hostCredentials, identities)

    if (isTauri) {
      return createSshSession({
        hostId: host.id,
        host: host.hostname,
        port: Number.parseInt(host.port || '22', 10),
        username: host.username,
        auth,
        sessionName: host.name,
      })
    }

    const api = await getApiClient()
    const token = await api.createSshToken({ host_id: host.id })

    return createSshSession({
      hostId: host.id,
      host: host.hostname,
      port: Number.parseInt(host.port || '22', 10),
      username: host.username,
      auth,
      websocketUrl: token.websocket_url,
      sessionName: host.name,
    })
  }

  async function disconnect(tab: TerminalTab): Promise<void> {
    await tab.session?.close()
    setTabs((current) =>
      current.map((item) =>
        item.id === tab.id ? { ...item, status: 'closed', session: null } : item,
      ),
    )
  }

  function closeTab(id: string): void {
    const tab = tabs.find((item) => item.id === id)
    void tab?.session?.close()
    const next = tabs.filter((item) => item.id !== id)
    setTabs(next)
    setActiveId(next[0]?.id ?? null)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <div className="flex h-9 items-stretch border-b border-border bg-bg-elev">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveId(tab.id)}
            className={cn(
              'flex items-center gap-2 border-r border-border px-3 font-mono text-[12px]',
              active?.id === tab.id ? 'bg-ansi-black text-fg' : 'text-fg-muted hover:bg-surface-2',
            )}
          >
            <Dot state={statusToDot(tab.status)} />
            <span>{tabTitle(tab)}</span>
            <X
              size={12}
              className="text-fg-faint"
              onClick={(event) => {
                event.stopPropagation()
                closeTab(tab.id)
              }}
            />
          </button>
        ))}
        <div className="flex items-center gap-2 px-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => addLocalTab()}
            aria-label="New local shell"
          >
            <Laptop size={13} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={requestedHost === null}
            onClick={() => requestedHost !== null && addHostTab(requestedHost)}
            aria-label="New SSH tab"
          >
            <Plus size={13} />
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-3 px-3 text-fg-faint">
          <SplitSquareHorizontal size={13} />
          <Server size={13} />
        </div>
      </div>

      {hostsQuery.isLoading || hostCredentialsQuery.isLoading || identitiesQuery.isLoading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-fg-faint">
          <Loader2 size={14} className="animate-spin" />
          Loading hosts
        </div>
      ) : active === null ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="max-w-sm text-center">
            <div className="mb-3 text-[14px] font-medium">No terminal tabs</div>
            <Button onClick={() => addLocalTab()}>
              <Laptop size={13} />
              Local shell
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex h-10 items-center gap-2 border-b border-border px-3">
            <div className="font-mono text-[12px] text-fg-muted">
              {active.kind === 'local'
                ? active.title
                : `ssh ${active.host.username || 'user'}@${active.host.hostname}:${
                    active.host.port || '22'
                  }`}
            </div>
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={active.status === 'connecting'}
                onClick={() => void connect(active)}
              >
                {active.status === 'connecting' ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Power size={13} />
                )}
                Connect
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={active.status === 'connecting'}
                onClick={() => void connect(active)}
              >
                <RotateCcw size={13} />
                Reconnect
              </Button>
              <Button size="sm" variant="outline" onClick={() => void disconnect(active)}>
                Disconnect
              </Button>
              {canUseAi && (
                <Button
                  size="sm"
                  variant={askAiOpen ? 'primary' : 'outline'}
                  onClick={() => setAskAiOpen((value) => !value)}
                  aria-pressed={askAiOpen}
                >
                  <Sparkles size={13} />
                  Ask AI
                </Button>
              )}
            </div>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-h-0">
              <XtermPane
                session={active.session}
                title={tabTitle(active)}
                terminalRef={terminalRef}
              />
            </div>
            {canUseAi && askAiOpen && (
              <AskAiPanel
                open={askAiOpen}
                onClose={() => setAskAiOpen(false)}
                terminalRef={terminalRef}
                sessionLabel={tabTitle(active)}
              />
            )}
          </div>
          <div className="flex h-6 items-center gap-4 border-t border-border bg-bg-elev px-3 font-mono text-[11px] text-fg-faint">
            <span>{active.status}</span>
            <span>UTF-8</span>
            <span>xterm-256color</span>
            <span>{active.kind === 'local' ? 'local' : 'ssh'}</span>
          </div>
        </>
      )}
    </div>
  )
}
