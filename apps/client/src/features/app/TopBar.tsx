import { listen } from '@tauri-apps/api/event'
import { Laptop, PanelLeftClose, PanelLeftOpen, Plus, Search, Server, X } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Dot } from '@/components/ui/dot'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/cn'
import { isTauri } from '@/lib/platform'
import {
  formatShortcut,
  isMac,
  isTerminalFocused,
  matchesShortcut,
  sessionNumber,
} from '@/lib/shortcuts'
import { useHosts } from '@/features/vault/hooks'
import { useVaultActionAccess } from '@/features/vault/access'
import { statusToDot, tabTitle, useTerminalActions } from '@/features/terminal/use-terminal-actions'
import { useAuth } from '@/stores/auth'
import { useLayout } from '@/stores/layout'
import { useTerminalTabs } from '@/stores/terminal'
import { useCommandUi } from './command-ui'
import { sectionFor } from './nav-items'

/** macOS desktop hides the native title bar; leave room for the traffic lights. */
const overlayTitleBar = isTauri && isMac

const tabClass =
  'group relative flex h-8 max-w-[200px] shrink-0 items-center rounded-md text-[12px] transition-colors duration-150'

function tabStateClass(active: boolean): string {
  return active
    ? 'bg-surface-2 text-fg after:absolute after:inset-x-2.5 after:-bottom-1.5 after:h-0.5 after:rounded-full after:bg-accent'
    : 'text-fg-muted hover:bg-surface hover:text-fg'
}

/**
 * Window-wide top bar: sidebar toggle, the Vault tab (current section), one tab per terminal
 * session, the "+" session menu and the command palette button. It doubles as the window's
 * drag region; `data-tauri-drag-region` only applies to the element that carries it, so the
 * buttons inside stay clickable.
 */
export function TopBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const collapsed = useLayout((s) => s.sidebarCollapsed)
  const toggleSidebar = useLayout((s) => s.toggleSidebar)
  const showPalette = useCommandUi((s) => s.show)
  const canConnect = useAuth((s) => s.hasPermission('hosts.connect'))
  const onTerminal = location.pathname.startsWith('/terminal')

  // The Vault tab returns to the last non-terminal page, query string included.
  // Tracked during render (React's "adjust state on prop change" pattern), not in an effect.
  const here = location.pathname + location.search
  const [lastVaultPath, setLastVaultPath] = useState('/hosts')
  if (!onTerminal && lastVaultPath !== here) setLastVaultPath(here)
  const section = sectionFor(lastVaultPath)

  return (
    <header
      data-tauri-drag-region
      className={cn(
        'flex h-11 shrink-0 select-none items-center gap-1 border-b border-border bg-bg-elev pr-2',
        overlayTitleBar ? 'pl-[78px]' : 'pl-2',
      )}
    >
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!collapsed}
        aria-controls="app-sidebar"
        title={`${collapsed ? 'Expand' : 'Collapse'} sidebar (${formatShortcut('sidebar')})`}
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-fg-faint transition-colors hover:bg-surface hover:text-fg"
      >
        {collapsed ? (
          <PanelLeftOpen size={16} aria-hidden />
        ) : (
          <PanelLeftClose size={16} aria-hidden />
        )}
      </button>

      <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />

      <nav
        aria-label="Tabs"
        className="flex min-w-0 items-center gap-1 overflow-x-auto py-1.5 [scrollbar-width:none]"
      >
        <button
          type="button"
          onClick={() => navigate(lastVaultPath)}
          aria-current={onTerminal ? undefined : 'page'}
          className={cn(tabClass, 'gap-2 px-3 font-medium', tabStateClass(!onTerminal))}
        >
          <section.icon
            size={14}
            aria-hidden
            className={onTerminal ? 'text-fg-faint' : 'text-accent'}
          />
          {section.label}
        </button>
        {isTauri && canConnect && <SessionTabs onTerminal={onTerminal} />}
      </nav>

      {isTauri && canConnect && <NewSessionMenu />}

      <div data-tauri-drag-region className="h-full min-w-6 flex-1" />

      <button
        type="button"
        onClick={() => showPalette('palette')}
        title={`Search and commands (${formatShortcut('palette')})`}
        className="flex h-8 w-56 shrink items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-[12px] text-fg-faint transition-colors hover:border-border-strong hover:text-fg-muted"
      >
        <Search size={14} aria-hidden />
        <span className="min-w-0 flex-1 truncate text-left">Search…</span>
        <Kbd id="palette" />
      </button>
    </header>
  )
}

function SessionTabs({ onTerminal }: { onTerminal: boolean }) {
  const navigate = useNavigate()
  const tabs = useTerminalTabs((s) => s.tabs)
  const activeId = useTerminalTabs((s) => s.activeId)
  const setActive = useTerminalTabs((s) => s.setActive)
  const { closeTab } = useTerminalActions()
  const currentId = activeId ?? tabs[0]?.id ?? null
  useSessionShortcuts()

  return tabs.map((tab, index) => {
    const isActive = onTerminal && tab.id === currentId
    const title = tabTitle(tab)
    const target = tab.kind === 'host' ? `${tab.host.username}@${tab.host.hostname}` : title
    // ⌘⌥1–9 / Alt+1–9 jump to the first nine tabs; the tooltip names the exact key.
    const jumpKey =
      index < 9 ? formatShortcut('terminal.goto').replace('1–9', String(index + 1)) : null
    return (
      <div
        key={tab.id}
        className={cn(tabClass, tabStateClass(isActive))}
        onAuxClick={(event) => {
          if (event.button === 1) closeTab(tab.id)
        }}
      >
        <button
          type="button"
          onClick={() => {
            setActive(tab.id)
            navigate('/terminal')
          }}
          aria-current={isActive ? 'page' : undefined}
          title={jumpKey === null ? target : `${target} (${jumpKey})`}
          className="flex h-full min-w-0 items-center gap-2 pl-3 pr-1"
        >
          <Dot state={statusToDot(tab.status)} size={6} />
          <span className="truncate">{title}</span>
        </button>
        <button
          type="button"
          onClick={() => closeTab(tab.id)}
          aria-label={`Close ${title}`}
          title={`Close (${formatShortcut('terminal.close')})`}
          className={cn(
            'mr-1.5 shrink-0 rounded-xs p-0.5 text-fg-faint hover:bg-surface-3 hover:text-fg focus-visible:opacity-100 group-hover:opacity-100',
            isActive ? 'opacity-100' : 'opacity-0',
          )}
        >
          <X size={12} aria-hidden />
        </button>
      </div>
    )
  })
}

function NewSessionMenu() {
  const navigate = useNavigate()
  const canConnectHosts = useVaultActionAccess()('hosts.connect')
  const hostsData = useHosts().data
  const hosts = canConnectHosts ? (hostsData ?? []) : []
  const { addHostTab, addLocalTab } = useTerminalActions()
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return undefined
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    function onPointerDown(event: MouseEvent): void {
      const target = event.target as Node
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    )
    const index = items.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      buttonRef.current?.focus()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      items[(index + step + items.length) % items.length]?.focus()
    }
  }

  function choose(start: () => void): void {
    setOpen(false)
    navigate('/terminal')
    start()
  }

  const itemClass =
    'flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12px] text-fg outline-none hover:bg-surface-2 focus-visible:bg-surface-2'

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="New session"
        aria-haspopup="menu"
        aria-expanded={open}
        title="New session"
        className="flex size-8 items-center justify-center rounded-md text-fg-faint transition-colors hover:bg-surface hover:text-fg"
      >
        <Plus size={16} aria-hidden />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="New session"
          onKeyDown={onMenuKeyDown}
          className="absolute left-0 top-full z-30 mt-1.5 w-72 overflow-hidden rounded-lg border border-border bg-bg-elev py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => choose(addLocalTab)}
            className={itemClass}
          >
            <Laptop size={14} aria-hidden className="shrink-0 text-fg-muted" />
            <span className="flex-1">Local shell</span>
            <Kbd id="terminal.newLocal" />
          </button>
          <div className="my-1 h-px bg-border-subtle" />
          <div className="px-3 pb-1 pt-1.5 text-[11px] font-medium text-fg-faint">Hosts</div>
          {hosts.length === 0 ? (
            <div className="px-3 py-2 text-[12px] text-fg-faint">
              {canConnectHosts
                ? 'No hosts yet. Add one on the Hosts page.'
                : 'Host connections are unavailable in this workspace.'}
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {hosts.map((host) => (
                <button
                  key={host.id}
                  type="button"
                  role="menuitem"
                  onClick={() => choose(() => addHostTab(host))}
                  className={itemClass}
                >
                  <Server size={14} aria-hidden className="shrink-0 text-fg-muted" />
                  <span className="truncate">{host.name || host.hostname}</span>
                  <span className="ml-auto truncate font-mono text-[10px] text-fg-faint">
                    {host.username ? `${host.username}@` : ''}
                    {host.hostname}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Session shortcuts from any section: ⌘T new, ⌘W close, ⌘⇧[ / ⌘⇧] cycle, ⌘⌥1–9 jump, plus
 * the native Tab menu's events (on macOS the menu owns ⌘T and ⌘W, so they arrive as events).
 * Switching a tab also brings you to the terminal.
 */
function useSessionShortcuts(): void {
  const navigate = useNavigate()
  const { addLocalTab, closeTab } = useTerminalActions()
  const actionsRef = useRef({ addLocalTab, closeTab })
  useEffect(() => {
    actionsRef.current = { addLocalTab, closeTab }
  })

  useEffect(() => {
    function cycle(step: number): void {
      const { tabs, activeId, setActive } = useTerminalTabs.getState()
      if (tabs.length === 0) return
      const index = Math.max(
        0,
        tabs.findIndex((tab) => tab.id === activeId),
      )
      const onTerminal = window.location.pathname.startsWith('/terminal')
      // From another section, the first press just returns to the current session.
      const target = onTerminal ? tabs[(index + step + tabs.length) % tabs.length] : tabs[index]
      setActive(target.id)
      navigate('/terminal')
    }

    function goTo(number: number): void {
      const { tabs, setActive } = useTerminalTabs.getState()
      const target = tabs[number - 1]
      if (target === undefined) return
      setActive(target.id)
      navigate('/terminal')
    }

    function newLocal(): void {
      navigate('/terminal')
      actionsRef.current.addLocalTab()
    }

    /** Closes the session you're looking at; does nothing outside the terminal. */
    function closeCurrent(): void {
      if (!window.location.pathname.startsWith('/terminal')) return
      const { tabs, activeId } = useTerminalTabs.getState()
      const current = tabs.find((tab) => tab.id === activeId) ?? tabs[0]
      if (current !== undefined) actionsRef.current.closeTab(current.id)
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (useCommandUi.getState().open !== null) return
      // Windows/Linux: Ctrl chords typed into the shell stay with the shell.
      if (!isMac && isTerminalFocused(event.target)) return
      const number = sessionNumber(event)
      if (number !== null) {
        event.preventDefault()
        goTo(number)
      } else if (matchesShortcut(event, 'terminal.newLocal')) {
        event.preventDefault()
        newLocal()
      } else if (matchesShortcut(event, 'terminal.close')) {
        event.preventDefault()
        closeCurrent()
      } else if (matchesShortcut(event, 'terminal.next')) {
        event.preventDefault()
        cycle(1)
      } else if (matchesShortcut(event, 'terminal.prev')) {
        event.preventDefault()
        cycle(-1)
      }
    }
    window.addEventListener('keydown', onKeyDown)

    let disposed = false
    const unlisteners: Array<() => void> = []
    const menuEvents: ReadonlyArray<readonly [string, () => void]> = [
      ['tab://next', () => cycle(1)],
      ['tab://prev', () => cycle(-1)],
      ['tab://new-local', newLocal],
      ['tab://close', closeCurrent],
    ]
    for (const [event, handler] of menuEvents) {
      void listen(event, handler).then((unlisten) => {
        if (disposed) unlisten()
        else unlisteners.push(unlisten)
      })
    }
    return () => {
      disposed = true
      window.removeEventListener('keydown', onKeyDown)
      unlisteners.forEach((unlisten) => unlisten())
    }
  }, [navigate])
}
