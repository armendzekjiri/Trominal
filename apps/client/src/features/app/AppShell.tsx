import {
  Code2,
  ExternalLink,
  FolderSync,
  KeyRound,
  Lock,
  LogOut,
  Search,
  Settings,
  Server,
  Terminal,
  Workflow,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Logo } from '@/components/branding/logo'
import { Kbd } from '@/components/ui/kbd'
import { TeamScopeSwitcher } from '@/features/teams/TeamScopeSwitcher'
import { cn } from '@/lib/cn'
import {
  formatShortcut,
  isMac,
  isTerminalFocused,
  matchesShortcut,
  type ShortcutId,
} from '@/lib/shortcuts'
import { useAuth } from '@/stores/auth'
import { useVault } from '@/stores/vault'
import { openAdminPanel } from './admin-panel'
import { CommandPalette } from './CommandPalette'
import { useCommandUi } from './command-ui'
import { ShortcutsDialog } from './ShortcutsDialog'

type NavItem = {
  to: string
  label: string
  permission: string
  icon: LucideIcon
  shortcut: ShortcutId
}

const NAV_ITEMS: ReadonlyArray<NavItem> = [
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

const rowClass =
  'group flex h-[34px] w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] font-medium transition-colors duration-150'

function navRowClass({ isActive }: { isActive: boolean }): string {
  return cn(
    rowClass,
    isActive ? 'bg-accent-soft text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
  )
}

function NavIcon({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
  return (
    <Icon
      size={16}
      aria-hidden
      className={cn(
        'shrink-0 transition-colors',
        active ? 'text-accent' : 'text-fg-faint group-hover:text-fg',
      )}
    />
  )
}

function initialsFor(email: string): string {
  const name = email.split('@')[0] ?? ''
  const parts = name.split(/[._-]+/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)
  return letters.toUpperCase() || '?'
}

/** App-wide shortcuts. Page-level ones (⌘F, ⌘N on Hosts) live on their page. */
function useGlobalShortcuts(): void {
  const navigate = useNavigate()
  const lock = useVault((s) => s.lock)
  const hasPermission = useAuth((s) => s.hasPermission)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      // In the terminal, Ctrl chords belong to the remote shell on Windows/Linux.
      if (!isMac && isTerminalFocused(event.target)) return
      const ui = useCommandUi.getState()

      if (matchesShortcut(event, 'palette')) {
        event.preventDefault()
        ui.toggle('palette')
        return
      }
      if (matchesShortcut(event, 'help')) {
        event.preventDefault()
        ui.toggle('shortcuts')
        return
      }
      // While an overlay is open, it owns the keyboard.
      if (ui.open !== null) return

      if (matchesShortcut(event, 'settings')) {
        event.preventDefault()
        navigate('/settings')
      } else if (matchesShortcut(event, 'lock')) {
        event.preventDefault()
        lock()
      } else {
        const item = NAV_ITEMS.find((nav) => matchesShortcut(event, nav.shortcut))
        if (item !== undefined && hasPermission(item.permission)) {
          event.preventDefault()
          navigate(item.to)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [hasPermission, lock, navigate])
}

export function AppShell() {
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const lock = useVault((s) => s.lock)
  const hasPermission = useAuth((s) => s.hasPermission)
  const isAdmin = user?.roles.includes('admin') ?? false
  const showPalette = useCommandUi((s) => s.show)
  useGlobalShortcuts()

  return (
    <div className="grid h-full grid-cols-[224px_1fr]">
      <aside className="flex min-h-0 flex-col gap-3 border-r border-border bg-bg-elev px-3 pb-3 pt-4">
        <div className="px-2.5">
          <Logo />
        </div>

        <button
          type="button"
          onClick={() => showPalette('palette')}
          className="flex h-8 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-[12px] text-fg-faint transition-colors hover:border-border-strong hover:text-fg-muted"
        >
          <Search size={14} aria-hidden />
          <span className="min-w-0 flex-1 truncate text-left">Jump to…</span>
          <Kbd id="palette" />
        </button>

        <TeamScopeSwitcher />

        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {NAV_ITEMS.filter((item) => hasPermission(item.permission)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={navRowClass}
              title={`${item.label} (${formatShortcut(item.shortcut)})`}
            >
              {({ isActive }) => (
                <>
                  <NavIcon icon={item.icon} active={isActive} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-0.5">
          <NavLink
            to="/settings"
            className={navRowClass}
            title={`Settings (${formatShortcut('settings')})`}
          >
            {({ isActive }) => (
              <>
                <NavIcon icon={Settings} active={isActive} />
                Settings
              </>
            )}
          </NavLink>
          <button
            type="button"
            onClick={lock}
            title={`Lock vault (${formatShortcut('lock')})`}
            className={cn(rowClass, 'text-fg-muted hover:bg-surface-2 hover:text-fg')}
          >
            <NavIcon icon={Lock} active={false} />
            Lock vault
          </button>
        </div>

        {user !== null && (
          <div className="flex items-center gap-2.5 rounded-lg border border-border bg-surface p-2">
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-soft font-mono text-[11px] font-semibold text-accent"
            >
              {initialsFor(user.email)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-fg">{user.email}</div>
              <div className="truncate text-[11px] text-fg-faint">
                {isAdmin ? 'Admin' : (user.roles[0] ?? 'Member')}
              </div>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => void openAdminPanel()}
                aria-label="Open admin panel"
                title="Open admin panel"
                className="rounded-md p-1.5 text-fg-faint transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <ExternalLink size={14} aria-hidden />
              </button>
            )}
            <button
              type="button"
              onClick={() => void logout()}
              aria-label="Sign out"
              title="Sign out"
              className="rounded-md p-1.5 text-fg-faint transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <LogOut size={14} aria-hidden />
            </button>
          </div>
        )}
      </aside>

      <main id="main-content" className="min-h-0 overflow-auto">
        <Outlet />
      </main>

      <CommandPalette />
      <ShortcutsDialog />
    </div>
  )
}
