import { createSshSession, type SshSession } from '@trominal/ssh-transport'
import { Loader2, Plus, Power, RotateCcw, Server, SplitSquareHorizontal, X } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Dot } from '@/components/ui/dot'
import { getApiClient } from '@/lib/api-client'
import { cn } from '@/lib/cn'
import { useHosts } from '@/features/vault/hooks'
import type { HostItem } from '@/features/vault/model'
import { XtermPane } from './XtermPane'

type TerminalTab = {
  id: string
  host: HostItem
  status: 'closed' | 'connected' | 'connecting'
  session: SshSession | null
}

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
  const [searchParams] = useSearchParams()
  const hostsQuery = useHosts()
  const hosts = hostsQuery.data ?? []
  const requestedHost =
    hosts.find((host) => host.id === searchParams.get('host')) ?? hosts[0] ?? null
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0] ?? null

  function addTab(host: HostItem): void {
    const id = crypto.randomUUID()
    setTabs((current) => [
      ...current,
      {
        id,
        host,
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
      const api = await getApiClient()
      const token = await api.createSshToken({ host_id: tab.host.id })
      const session = createSshSession({
        hostId: tab.host.id,
        host: tab.host.hostname,
        port: Number.parseInt(tab.host.port || '22', 10),
        username: tab.host.username,
        websocketUrl: token.websocket_url,
        sessionName: tab.host.name,
      })
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
            <span>{tab.host.name || tab.host.hostname}</span>
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
            disabled={requestedHost === null}
            onClick={() => requestedHost !== null && addTab(requestedHost)}
          >
            <Plus size={13} />
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-3 px-3 text-fg-faint">
          <SplitSquareHorizontal size={13} />
          <Server size={13} />
        </div>
      </div>

      {hostsQuery.isLoading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-fg-faint">
          <Loader2 size={14} className="animate-spin" />
          Loading hosts
        </div>
      ) : active === null ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="max-w-sm text-center">
            <div className="mb-3 text-[14px] font-medium">No terminal tabs</div>
            <div className="mb-4 text-[12px] text-fg-faint">
              Open a host from the Hosts screen, or start a tab from the first available host.
            </div>
            <Button
              disabled={requestedHost === null}
              onClick={() => requestedHost !== null && addTab(requestedHost)}
            >
              <Plus size={13} />
              New session
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex h-10 items-center gap-2 border-b border-border px-3">
            <div className="font-mono text-[12px] text-fg-muted">
              ssh {active.host.username || 'user'}@{active.host.hostname}:{active.host.port || '22'}
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
              <Button size="sm" variant="outline" onClick={() => void connect(active)}>
                <RotateCcw size={13} />
                Reconnect
              </Button>
              <Button size="sm" variant="outline" onClick={() => void disconnect(active)}>
                Disconnect
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <XtermPane session={active.session} title={active.host.name || active.host.hostname} />
          </div>
          <div className="flex h-6 items-center gap-4 border-t border-border bg-bg-elev px-3 font-mono text-[11px] text-fg-faint">
            <span>{active.status}</span>
            <span>UTF-8</span>
            <span>xterm-256color</span>
            <span>copy/paste enabled by browser and xterm selection</span>
          </div>
        </>
      )}
    </div>
  )
}
