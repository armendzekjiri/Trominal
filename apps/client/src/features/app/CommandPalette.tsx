import {
  ArrowRight,
  Code2,
  ExternalLink,
  FolderSync,
  Keyboard,
  KeyRound,
  Lock,
  LogOut,
  Moon,
  Plus,
  Search,
  Server,
  Settings,
  Sun,
  Terminal,
  Unplug,
  Workflow,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/cn'
import type { ShortcutId } from '@/lib/shortcuts'
import { useHosts } from '@/features/vault/hooks'
import { useAppearance } from '@/stores/appearance'
import { useAuth } from '@/stores/auth'
import { useVault } from '@/stores/vault'
import { useCommandUi } from './command-ui'
import { openAdminPanel } from './admin-panel'

type Command = {
  id: string
  label: string
  group: 'Hosts' | 'Go to' | 'Settings' | 'Actions'
  icon: LucideIcon
  keywords?: string
  hint?: string
  shortcut?: ShortcutId
  run: () => void
}

const SETTINGS_TABS: ReadonlyArray<{ id: string; label: string; permission?: string }> = [
  { id: 'connection', label: 'Connection' },
  { id: 'account', label: 'Account and two-factor' },
  { id: 'ai', label: 'AI', permission: 'ai.use' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'shortcuts', label: 'Keyboard shortcuts' },
  { id: 'advanced', label: 'Advanced' },
]

const NAV: ReadonlyArray<{
  to: string
  label: string
  permission: string
  icon: LucideIcon
  shortcut: ShortcutId
}> = [
  { to: '/hosts', label: 'Hosts', permission: 'hosts.read', icon: Server, shortcut: 'nav.hosts' },
  {
    to: '/terminal',
    label: 'Terminal',
    permission: 'hosts.connect',
    icon: Terminal,
    shortcut: 'nav.terminal',
  },
  {
    to: '/snippets',
    label: 'Snippets',
    permission: 'snippets.read',
    icon: Code2,
    shortcut: 'nav.snippets',
  },
  {
    to: '/identities',
    label: 'Identities',
    permission: 'identities.read',
    icon: KeyRound,
    shortcut: 'nav.identities',
  },
  {
    to: '/tunnels',
    label: 'Tunnels',
    permission: 'tunnels.read',
    icon: Workflow,
    shortcut: 'nav.tunnels',
  },
  { to: '/sftp', label: 'SFTP', permission: 'sftp.read', icon: FolderSync, shortcut: 'nav.sftp' },
]

const GROUP_ORDER: ReadonlyArray<Command['group']> = ['Actions', 'Go to', 'Hosts', 'Settings']

/** Lower score = better. Prefix match beats word match beats in-order letters. */
function score(command: Command, query: string): number | null {
  if (query === '') return 0
  const haystack = `${command.label} ${command.keywords ?? ''}`.toLowerCase()
  const q = query.toLowerCase()
  if (haystack.startsWith(q)) return 0
  if (haystack.split(/\s+/).some((word) => word.startsWith(q))) return 1
  if (haystack.includes(q)) return 2
  let i = 0
  for (const char of haystack) if (char === q[i]) i += 1
  return i === q.length ? 3 : null
}

export function CommandPalette() {
  const open = useCommandUi((s) => s.open === 'palette')
  return open ? <PaletteDialog /> : null
}

function PaletteDialog() {
  const close = useCommandUi((s) => s.close)
  const showShortcuts = useCommandUi((s) => s.show)
  const navigate = useNavigate()
  const hostsData = useHosts().data
  const user = useAuth((s) => s.user)
  const hasPermission = useAuth((s) => s.hasPermission)
  const logout = useAuth((s) => s.logout)
  const lock = useVault((s) => s.lock)
  const appTheme = useAppearance((s) => s.appTheme)
  const setAppTheme = useAppearance((s) => s.setAppTheme)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const commands = useMemo<Command[]>(() => {
    const hosts = hostsData ?? []
    const go = (to: string) => () => navigate(to)
    const isDark = appTheme !== 'light'
    const list: Command[] = [
      {
        id: 'new-host',
        label: 'New host',
        group: 'Actions',
        icon: Plus,
        keywords: 'add create server',
        shortcut: 'hosts.new',
        run: go('/hosts?new=1'),
      },
      {
        id: 'theme',
        label: isDark ? 'Switch to light theme' : 'Switch to dark theme',
        group: 'Actions',
        icon: isDark ? Sun : Moon,
        keywords: 'appearance mode toggle',
        run: () => setAppTheme(isDark ? 'light' : 'dark'),
      },
      {
        id: 'lock',
        label: 'Lock vault',
        group: 'Actions',
        icon: Lock,
        shortcut: 'lock',
        run: lock,
      },
      {
        id: 'shortcuts',
        label: 'Keyboard shortcuts',
        group: 'Actions',
        icon: Keyboard,
        keywords: 'help keys hotkeys',
        shortcut: 'help',
        run: () => showShortcuts('shortcuts'),
      },
      {
        id: 'switch-server',
        label: 'Switch server',
        group: 'Actions',
        icon: Unplug,
        keywords: 'connect url backend',
        run: go('/connect'),
      },
      {
        id: 'sign-out',
        label: 'Sign out',
        group: 'Actions',
        icon: LogOut,
        keywords: 'logout log out',
        run: () => void logout(),
      },
    ]
    if (user?.roles.includes('admin') === true) {
      list.push({
        id: 'admin',
        label: 'Open admin panel',
        group: 'Actions',
        icon: ExternalLink,
        keywords: 'filament users roles audit',
        run: () => void openAdminPanel(),
      })
    }
    for (const item of NAV) {
      if (!hasPermission(item.permission)) continue
      list.push({
        id: `nav-${item.to}`,
        label: item.label,
        group: 'Go to',
        icon: item.icon,
        shortcut: item.shortcut,
        run: go(item.to),
      })
    }
    for (const tab of SETTINGS_TABS) {
      if (tab.permission !== undefined && !hasPermission(tab.permission)) continue
      list.push({
        id: `settings-${tab.id}`,
        label: tab.label,
        group: 'Settings',
        icon: Settings,
        keywords: 'settings preferences',
        shortcut: tab.id === 'connection' ? 'settings' : undefined,
        run: go(`/settings?tab=${tab.id}`),
      })
    }
    if (hasPermission('hosts.connect')) {
      for (const host of hosts) {
        list.push({
          id: `host-${host.id}`,
          label: `Connect to ${host.name || host.hostname}`,
          group: 'Hosts',
          icon: Terminal,
          keywords: `${host.hostname} ${host.username} ${host.tags.join(' ')} ssh`,
          hint: `${host.username ? `${host.username}@` : ''}${host.hostname}`,
          run: go(`/terminal?host=${host.id}`),
        })
      }
    }
    return list
  }, [appTheme, hasPermission, hostsData, lock, logout, navigate, setAppTheme, showShortcuts, user])

  const results = useMemo(() => {
    const scored = commands
      .map((command) => ({ command, rank: score(command, query.trim()) }))
      .filter((item): item is { command: Command; rank: number } => item.rank !== null)
    // Hosts only appear once the user types: an empty palette lists actions and places.
    const visible = query.trim() === '' ? scored.filter((i) => i.command.group !== 'Hosts') : scored
    return visible
      .sort(
        (a, b) =>
          a.rank - b.rank ||
          GROUP_ORDER.indexOf(a.command.group) - GROUP_ORDER.indexOf(b.command.group),
      )
      .map((item) => item.command)
  }, [commands, query])

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    inputRef.current?.focus()
    return () => previous?.focus?.()
  }, [])

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function runAt(index: number): void {
    const command = results[index]
    if (command === undefined) return
    if (command.id !== 'shortcuts') close()
    command.run()
  }

  function onKeyDown(event: React.KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActive(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActive(Math.max(results.length - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      runAt(active)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
    } else if (event.key === 'Tab') {
      // Single focusable control: keep focus inside the dialog.
      event.preventDefault()
    }
  }

  let lastGroup: Command['group'] | null = null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg/70 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={onKeyDown}
        className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border-strong bg-bg-elev shadow-2xl"
      >
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
          <Search size={16} className="shrink-0 text-fg-faint" aria-hidden />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
            aria-label="Search commands and hosts"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
            }}
            placeholder="Search hosts, pages and actions…"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-fg-faint"
          />
          <kbd className="rounded-xs border border-border-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">
            Esc
          </kbd>
        </div>

        <div ref={listRef} id={listId} role="listbox" className="min-h-0 flex-1 overflow-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-fg-muted">
              Nothing matches “{query}”.
            </p>
          ) : (
            results.map((command, index) => {
              const header = command.group !== lastGroup ? command.group : null
              lastGroup = command.group
              return (
                <div key={command.id}>
                  {header !== null && (
                    <div
                      role="presentation"
                      className="px-3 pb-1 pt-3 text-[11px] font-medium text-fg-faint first:pt-1"
                    >
                      {header}
                    </div>
                  )}
                  <div
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    data-index={index}
                    onMouseMove={() => setActive(index)}
                    onClick={() => runAt(index)}
                    className={cn(
                      'flex h-10 cursor-pointer items-center gap-3 rounded-md px-3 text-[13px]',
                      index === active ? 'bg-accent-soft text-fg' : 'text-fg-muted',
                    )}
                  >
                    <command.icon
                      size={15}
                      aria-hidden
                      className={cn('shrink-0', index === active ? 'text-accent' : 'text-fg-faint')}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {command.label}
                      {command.hint !== undefined && (
                        <span className="ml-2 font-mono text-[11px] text-fg-faint">
                          {command.hint}
                        </span>
                      )}
                    </span>
                    {command.shortcut !== undefined ? (
                      <Kbd id={command.shortcut} />
                    ) : index === active ? (
                      <ArrowRight size={13} className="text-fg-faint" aria-hidden />
                    ) : null}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="flex shrink-0 items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-fg-faint">
          <span>
            <kbd className="font-mono">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="font-mono">↵</kbd> open
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            Shortcuts <Kbd id="help" />
          </span>
        </div>
      </div>
    </div>
  )
}
