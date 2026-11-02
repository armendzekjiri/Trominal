import { useTerminalTabs } from '@/stores/terminal'
import type { Terminal } from '@xterm/xterm'
import { Laptop, Loader2, Power, RotateCcw, Sparkles, TerminalSquare } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/cn'
import { isTauri } from '@/lib/platform'
import { useAuth } from '@/stores/auth'
import { useHostCredentials, useHosts, useIdentities } from '@/features/vault/hooks'
import type { HostItem } from '@/features/vault/model'
import { AskAiPanel, type PendingPrompt } from '@/features/ai/AskAiPanel'
import { InlineSuggestion } from '@/features/ai/InlineSuggestion'
import { TerminalContextMenu } from '@/features/ai/TerminalContextMenu'
import { tabTitle, useTerminalActions } from './use-terminal-actions'
import { XtermPane } from './XtermPane'

export function TerminalPage() {
  if (!isTauri) {
    return <WebTerminalUnavailable />
  }

  return <DesktopTerminalPage />
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

/**
 * The active session's toolbar and terminal panes. Session tabs, the "+" menu and the tab
 * shortcuts live in the app top bar (`features/app/TopBar.tsx`).
 */
function DesktopTerminalPage() {
  const [searchParams] = useSearchParams()
  const hostsQuery = useHosts()
  const hostCredentialsQuery = useHostCredentials()
  const identitiesQuery = useIdentities()
  // Memoized so `hosts` is a stable dep for the auto-open effect below.
  const hosts = useMemo(() => hostsQuery.data ?? [], [hostsQuery.data])
  // Tab + session state lives in the store so it survives navigation.
  const tabs = useTerminalTabs((state) => state.tabs)
  const activeId = useTerminalTabs((state) => state.activeId)
  const setActiveId = useTerminalTabs((state) => state.setActive)
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0] ?? null
  const { connect, disconnect, addHostTab, addLocalTab } = useTerminalActions()
  const [askAiOpen, setAskAiOpen] = useState(false)
  const terminalRef = useRef<Terminal | null>(null)
  const canUseAi = useAuth((s) => s.hasPermission('ai.use'))
  // Each tab keeps its own live Terminal so its scrollback stays isolated;
  // switching tabs is a CSS show/hide, not a session swap on a shared
  // Terminal (which would carry stale screen content into the new tab).
  const [terminalsByTab, setTerminalsByTab] = useState<
    Map<string, { terminal: Terminal; element: HTMLDivElement }>
  >(() => new Map())
  const activeEntry = activeId === null ? undefined : terminalsByTab.get(activeId)
  const activeTerminal = activeEntry?.terminal ?? null
  const terminalElement = activeEntry?.element ?? null
  const [pendingPrompt, setPendingPrompt] = useState<PendingPrompt | null>(null)
  // Keep the late-binding terminalRef pointed at the active tab's xterm so
  // AskAi (which reads scrollback) always sees the right one. Refresh in
  // a passive effect — never write a ref during render.
  useEffect(() => {
    terminalRef.current = activeTerminal
  }, [activeTerminal])

  // One ready handler per tab id — registers the tab's terminal in the
  // map on mount, removes it on unmount. Returns a stable function from a
  // memoized factory so XtermPane's lifecycle effect isn't torn down by a
  // changing handler reference.
  const makeTerminalReadyHandler = useCallback(
    (tabId: string) => (terminal: Terminal, element: HTMLDivElement) => {
      setTerminalsByTab((prev) => {
        const next = new Map(prev)
        next.set(tabId, { terminal, element })
        return next
      })
      return () => {
        setTerminalsByTab((prev) => {
          const next = new Map(prev)
          next.delete(tabId)
          return next
        })
      }
    },
    [],
  )

  // Mirror live state into refs so the auto-open effect can read the
  // newest tabs and the freshest addHostTab without listing them as deps
  // (which would loop the effect every time it fires).
  const tabsRef = useRef(tabs)
  useEffect(() => {
    tabsRef.current = tabs
  })
  const addHostTabRef = useRef<(host: HostItem) => void>(() => undefined)
  useEffect(() => {
    addHostTabRef.current = addHostTab
  })

  // Auto-open + auto-connect a host tab when the user lands here from
  // /hosts via "Connect" (URL: /terminal?host=<id>). Deduped via a ref so
  // we don't loop when tabs / queries update.
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

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      {hostsQuery.isLoading || hostCredentialsQuery.isLoading || identitiesQuery.isLoading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-fg-faint">
          <Loader2 size={14} className="animate-spin" />
          Loading hosts
        </div>
      ) : active === null ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex max-w-sm flex-col items-center text-center">
            <span className="mb-4 flex size-12 items-center justify-center rounded-lg border border-border bg-surface text-accent">
              <TerminalSquare size={20} aria-hidden />
            </span>
            <h1 className="text-[15px] font-semibold text-fg">No open sessions</h1>
            <p className="mb-4 mt-1 text-[12px] leading-relaxed text-fg-muted">
              Open a local shell, or pick a host from <span className="font-medium">+</span> in the
              top bar. Sessions keep running while you use the rest of the app.
            </p>
            <Button onClick={() => addLocalTab()}>
              <Laptop size={13} />
              Local shell
              <Kbd id="terminal.newLocal" className="ml-1" />
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
              {/* One Terminal per tab, kept mounted across switches so each
                  tab keeps its own scrollback and current screen state.
                  Inactive tabs are hidden via CSS rather than unmounted —
                  unmounting would dispose the xterm and lose buffer. */}
              {tabs.map((tab) => {
                const isTabActive = tab.id === active.id
                return (
                  <div
                    key={tab.id}
                    className={cn('absolute inset-0', isTabActive ? 'block' : 'hidden')}
                    aria-hidden={!isTabActive}
                  >
                    <XtermPane
                      session={tab.session}
                      isActive={isTabActive}
                      onTerminalReady={makeTerminalReadyHandler(tab.id)}
                    />
                  </div>
                )
              })}
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
