import { createLocalShellSession, createSshSession, type SshSession } from '@trominal/ssh-transport'
import { listen } from '@tauri-apps/api/event'
import { useTerminalTabs, type TerminalTab } from '@/stores/terminal'
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { AskAiPanel, type PendingPrompt } from '@/features/ai/AskAiPanel'
import { InlineSuggestion } from '@/features/ai/InlineSuggestion'
import { TerminalContextMenu } from '@/features/ai/TerminalContextMenu'
import { XtermPane } from './XtermPane'

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
  // Memoize fallbacks so React doesn't see a new empty array each render —
  // matters because `hosts` is a useEffect dep below and would otherwise
  // re-fire the auto-open effect on every parent render.
  const hosts = useMemo(() => hostsQuery.data ?? [], [hostsQuery.data])
  const hostCredentials = useMemo(
    () => hostCredentialsQuery.data ?? [],
    [hostCredentialsQuery.data],
  )
  const identities = useMemo(() => identitiesQuery.data ?? [], [identitiesQuery.data])
  // Tab + session state lives in the store so it survives navigation.
  // Sessions are GC-rooted by the store; the underlying Tauri PTY child
  // stays alive on the Rust side until the user explicitly closes the tab.
  const tabs = useTerminalTabs((state) => state.tabs)
  const activeId = useTerminalTabs((state) => state.activeId)
  const setActiveId = useTerminalTabs((state) => state.setActive)
  const addStoreTab = useTerminalTabs((state) => state.addTab)
  const patchTab = useTerminalTabs((state) => state.patchTab)
  const removeStoreTab = useTerminalTabs((state) => state.removeTab)
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0] ?? null
  const [askAiOpen, setAskAiOpen] = useState(false)
  const terminalRef = useRef<Terminal | null>(null)
  const canUseAi = useAuth((s) => s.hasPermission('ai.use'))
  // Track the live xterm + its host element in state so the inline-suggestion
  // and context-menu overlays (mounted as siblings of XtermPane) re-render
  // when tabs are switched. The ref above is for late-binding consumers.
  const [activeTerminal, setActiveTerminal] = useState<Terminal | null>(null)
  const [terminalElement, setTerminalElement] = useState<HTMLDivElement | null>(null)
  const [pendingPrompt, setPendingPrompt] = useState<PendingPrompt | null>(null)

  // Wire the native "Tab" menu bar items (Ctrl+Tab / Ctrl+Shift+Tab) to
  // our tab store. The Rust side emits these events; the OS catches the
  // accelerator before the WebView so xterm never sees the keystroke.
  // Read the live store via getState so this listener doesn't capture
  // stale tabs / activeId after the user opens or closes tabs.
  useEffect(() => {
    if (!isTauri) return undefined
    function step(direction: 1 | -1): void {
      const { tabs: tabsList, activeId: activeIdNow } = useTerminalTabs.getState()
      if (tabsList.length === 0) return
      const idx = Math.max(
        0,
        tabsList.findIndex((tab) => tab.id === activeIdNow),
      )
      const nextIdx = (idx + direction + tabsList.length) % tabsList.length
      const target = tabsList[nextIdx]
      if (target !== undefined) setActiveId(target.id)
    }
    const unlisteners: Array<() => void> = []
    void listen('tab://next', () => step(1)).then((unlisten) => unlisteners.push(unlisten))
    void listen('tab://prev', () => step(-1)).then((unlisten) => unlisteners.push(unlisten))
    return () => {
      unlisteners.forEach((unlisten) => unlisten())
    }
  }, [setActiveId])

  // "+" button → host picker. Auto-picking the first host (the prior
  // behaviour) was opaque from the user's POV: they had no idea which
  // host would open. The menu lists everything and the user chooses.
  const [hostMenuOpen, setHostMenuOpen] = useState(false)
  const hostMenuButtonRef = useRef<HTMLButtonElement>(null)
  const hostMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!hostMenuOpen) return undefined
    function onPointerDown(event: MouseEvent): void {
      const target = event.target as Node
      if (hostMenuButtonRef.current?.contains(target)) return
      if (hostMenuRef.current?.contains(target)) return
      setHostMenuOpen(false)
    }
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') setHostMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [hostMenuOpen])

  // Stable handler so XtermPane's terminal lifecycle effect isn't torn
  // down on every parent re-render. The setters from useState are
  // already stable, so empty deps are correct.
  const handleTerminalReady = useCallback((terminal: Terminal, element: HTMLDivElement) => {
    setActiveTerminal(terminal)
    setTerminalElement(element)
    return () => {
      setActiveTerminal(null)
      setTerminalElement(null)
    }
  }, [])

  // Mirror live state into refs so the auto-open effect can read the
  // newest tabs and the freshest addHostTab without listing them as deps
  // (which would loop the effect every time it fires).
  const tabsRef = useRef(tabs)
  useEffect(() => {
    tabsRef.current = tabs
  })
  const addHostTabRef = useRef<(host: HostItem) => void>(() => undefined)

  function addHostTab(host: HostItem): void {
    const id = crypto.randomUUID()
    const tab: TerminalTab = {
      id,
      kind: 'host',
      host,
      status: 'closed',
      session: null,
    }
    addStoreTab(tab)
    void connect(tab)
  }
  // Keep the ref in sync with the latest closure so the auto-open effect
  // calls a fresh `connect` (and the latest hostCredentials / identities).
  useEffect(() => {
    addHostTabRef.current = addHostTab
  })

  // Auto-open + auto-connect a host tab when the user lands here from
  // /hosts via "Connect" (URL: /terminal?host=<id>). Without this, the
  // page just sat at the empty state and forced a manual "+ → connect".
  // Deduped via a ref so we don't loop when tabs / queries update.
  const autoOpenedHostId = useRef<string | null>(null)
  const queriesReady =
    !hostsQuery.isLoading && !hostCredentialsQuery.isLoading && !identitiesQuery.isLoading
  useEffect(() => {
    if (!queriesReady) return
    const hostId = searchParams.get('host')
    if (hostId === null || hostId === autoOpenedHostId.current) return
    const host = hosts.find((candidate) => candidate.id === hostId)
    if (host === undefined) return
    autoOpenedHostId.current = hostId
    const existing = tabsRef.current.find((tab) => tab.kind === 'host' && tab.host.id === hostId)
    if (existing !== undefined) {
      setActiveId(existing.id)
    } else {
      addHostTabRef.current(host)
    }
  }, [searchParams, hosts, queriesReady, setActiveId])

  function addLocalTab(): void {
    const id = crypto.randomUUID()
    const tab: TerminalTab = {
      id,
      kind: 'local',
      title: 'Local shell',
      status: 'closed',
      session: null,
    }
    addStoreTab(tab)
    void connect(tab)
  }

  async function connect(tab: TerminalTab): Promise<void> {
    patchTab(tab.id, { status: 'connecting' })
    try {
      const session =
        tab.kind === 'local'
          ? createLocalShellSession({ sessionName: tab.title })
          : await hostSession(tab.host)
      patchTab(tab.id, { session })
      await session.connect()
      patchTab(tab.id, { status: 'connected', session })
    } catch {
      patchTab(tab.id, { status: 'closed', session: null })
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
    patchTab(tab.id, { status: 'closed', session: null })
  }

  function closeTab(id: string): void {
    // Read the freshest tab snapshot from the store so we don't capture a
    // stale `tabs` array if the user closes mid-render.
    const tab = useTerminalTabs.getState().tabs.find((item) => item.id === id)
    void tab?.session?.close()
    removeStoreTab(id)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <div className="flex h-9 items-stretch border-b border-border bg-bg-elev">
        {tabs.map((tab) => {
          const isActive = active?.id === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveId(tab.id)}
              aria-pressed={isActive}
              className={cn(
                'relative flex items-center gap-2 border-r border-border px-3 font-mono text-[12px]',
                isActive
                  ? 'bg-bg text-fg font-medium'
                  : 'bg-bg-elev text-fg-muted hover:bg-surface-2',
              )}
            >
              {/* 2px accent stripe along the top of the active tab —
                  matches the VS Code / browser pattern and reads at a
                  glance even with a long tab list. */}
              {isActive && (
                <span className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-accent" />
              )}
              <Dot state={statusToDot(tab.status)} />
              <span>{tabTitle(tab)}</span>
              <X
                size={12}
                className="text-fg-faint hover:text-fg"
                onClick={(event) => {
                  event.stopPropagation()
                  closeTab(tab.id)
                }}
              />
            </button>
          )
        })}
        <div className="flex items-center gap-2 px-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => addLocalTab()}
            aria-label="New local shell"
          >
            <Laptop size={13} />
          </Button>
          <div className="relative">
            <Button
              ref={hostMenuButtonRef}
              size="sm"
              variant="ghost"
              onClick={() => setHostMenuOpen((value) => !value)}
              aria-label="Open host"
              aria-haspopup="menu"
              aria-expanded={hostMenuOpen}
            >
              <Plus size={13} />
            </Button>
            {hostMenuOpen && (
              <div
                ref={hostMenuRef}
                role="menu"
                className="absolute left-0 top-full z-20 mt-1 min-w-[260px] overflow-hidden rounded-md border border-border bg-bg-elev shadow-lg"
              >
                {hosts.length === 0 ? (
                  <div className="px-3 py-2 text-[11px] text-fg-faint">
                    No hosts saved yet — add one from the Hosts page.
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto py-1">
                    {hosts.map((host) => (
                      <button
                        key={host.id}
                        role="menuitem"
                        type="button"
                        onClick={() => {
                          setHostMenuOpen(false)
                          addHostTab(host)
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-surface-2"
                      >
                        <Server size={13} className="shrink-0 text-fg-muted" />
                        <span className="truncate">{host.name || host.hostname}</span>
                        <span className="ml-auto truncate font-mono text-[10px] text-fg-faint">
                          {host.username ? `${host.username}@` : ''}
                          {host.hostname}
                          {host.port && host.port !== '22' ? `:${host.port}` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
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
              {/* Buttons follow status so we never offer "Connect" while the
                  session is already up. Local shells get "Restart"; hosts
                  get "Connect" (closed) or "Reconnect" (live). */}
              {active.status === 'closed' && active.kind === 'host' && (
                <Button size="sm" variant="outline" onClick={() => void connect(active)}>
                  <Power size={13} />
                  Connect
                </Button>
              )}
              {active.status === 'closed' && active.kind === 'local' && (
                <Button size="sm" variant="outline" onClick={() => void connect(active)}>
                  <RotateCcw size={13} />
                  Restart
                </Button>
              )}
              {active.status === 'connecting' && (
                <>
                  <Button size="sm" variant="outline" disabled>
                    <Loader2 size={13} className="animate-spin" />
                    Connecting…
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void disconnect(active)}>
                    Cancel
                  </Button>
                </>
              )}
              {active.status === 'connected' && (
                <>
                  <Button size="sm" variant="outline" onClick={() => void connect(active)}>
                    <RotateCcw size={13} />
                    {active.kind === 'local' ? 'Restart' : 'Reconnect'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void disconnect(active)}>
                    Disconnect
                  </Button>
                </>
              )}
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
          <div className="flex min-h-0 flex-1">
            <div className="relative flex-1 min-h-0 overflow-hidden">
              <XtermPane
                session={active.session}
                terminalRef={terminalRef}
                onTerminalReady={handleTerminalReady}
              />
              {canUseAi && activeTerminal !== null && (
                <InlineSuggestion terminal={activeTerminal} session={active.session} />
              )}
              {canUseAi && activeTerminal !== null && terminalElement !== null && (
                <TerminalContextMenu
                  terminal={activeTerminal}
                  element={terminalElement}
                  onExplain={(text) => {
                    setAskAiOpen(true)
                    setPendingPrompt({ text: `/explain ${text}`, nonce: Date.now() })
                  }}
                />
              )}
            </div>
            {canUseAi && askAiOpen && (
              <AskAiPanel
                open={askAiOpen}
                onClose={() => setAskAiOpen(false)}
                terminalRef={terminalRef}
                sessionLabel={tabTitle(active)}
                pendingPrompt={pendingPrompt}
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
