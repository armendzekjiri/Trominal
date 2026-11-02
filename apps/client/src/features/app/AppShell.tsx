import { ExternalLink, Lock, LogOut, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { TeamScopeSwitcher } from '@/features/teams/TeamScopeSwitcher'
import { cn } from '@/lib/cn'
import { formatShortcut, isMac, isTerminalFocused, matchesShortcut } from '@/lib/shortcuts'
import { useAuth } from '@/stores/auth'
import { useLayout } from '@/stores/layout'
import { useVault } from '@/stores/vault'
import { openAdminPanel } from './admin-panel'
import { CommandPalette } from './CommandPalette'
import { useCommandUi } from './command-ui'
import { NAV_ITEMS } from './nav-items'
import { ShortcutsDialog } from './ShortcutsDialog'
import { HostKeyDialog } from '@/features/hosts/HostKeyDialog'
import { TopBar } from './TopBar'

function rowClass(collapsed: boolean): string {
  return cn(
    'group flex h-[34px] items-center rounded-md text-left text-[13px] font-medium transition-colors duration-150',
    collapsed ? 'w-9 justify-center self-center' : 'w-full gap-2.5 px-2.5',
  )
}

function navRowClass(collapsed: boolean) {
  return ({ isActive }: { isActive: boolean }): string =>
    cn(
      rowClass(collapsed),
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

/** Label next to a sidebar icon; collapsed, it stays for screen readers only. */
function RowLabel({ collapsed, children }: { collapsed: boolean; children: string }) {
  return <span className={collapsed ? 'sr-only' : 'truncate'}>{children}</span>
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
  const toggleSidebar = useLayout((s) => s.toggleSidebar)

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
      } else if (matchesShortcut(event, 'sidebar')) {
        event.preventDefault()
        toggleSidebar()
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
  }, [hasPermission, lock, navigate, toggleSidebar])
}

export function AppShell() {
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const lock = useVault((s) => s.lock)
  const hasPermission = useAuth((s) => s.hasPermission)
  const collapsed = useLayout((s) => s.sidebarCollapsed)
  const isAdmin = user?.roles.includes('admin') ?? false
  useGlobalShortcuts()

  const iconButtonClass =
    'rounded-md p-1.5 text-fg-faint transition-colors hover:bg-surface-2 hover:text-fg'

  return (
    <div className="flex h-full flex-col">
      <TopBar />

      <div className="flex min-h-0 flex-1">
        <aside
          id="app-sidebar"
          aria-label="Sidebar"
          className={cn(
            'flex min-h-0 shrink-0 flex-col gap-3 overflow-hidden border-r border-border bg-bg-elev py-3 transition-[width] duration-200 motion-reduce:transition-none',
            collapsed ? 'w-[60px] px-2' : 'w-[224px] px-3',
          )}
        >
          {!collapsed && <TeamScopeSwitcher />}

          <nav aria-label="Main" className="flex flex-col gap-0.5">
            {NAV_ITEMS.filter((item) => hasPermission(item.permission)).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={navRowClass(collapsed)}
                title={`${item.label} (${formatShortcut(item.shortcut)})`}
              >
                {({ isActive }) => (
                  <>
                    <NavIcon icon={item.icon} active={isActive} />
                    <RowLabel collapsed={collapsed}>{item.label}</RowLabel>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-0.5">
            <NavLink
              to="/settings"
              className={navRowClass(collapsed)}
              title={`Settings (${formatShortcut('settings')})`}
            >
              {({ isActive }) => (
                <>
                  <NavIcon icon={Settings} active={isActive} />
                  <RowLabel collapsed={collapsed}>Settings</RowLabel>
                </>
              )}
            </NavLink>
            <button
              type="button"
              onClick={lock}
              title={`Lock vault (${formatShortcut('lock')})`}
              className={cn(rowClass(collapsed), 'text-fg-muted hover:bg-surface-2 hover:text-fg')}
            >
              <NavIcon icon={Lock} active={false} />
              <RowLabel collapsed={collapsed}>Lock vault</RowLabel>
            </button>
          </div>

          {user !== null &&
            (collapsed ? (
              <span
                title={`${user.email} · ${isAdmin ? 'Admin' : (user.roles[0] ?? 'Member')}`}
                className="flex size-9 items-center justify-center self-center rounded-md bg-accent-soft font-mono text-[11px] font-semibold text-accent"
              >
                {initialsFor(user.email)}
              </span>
            ) : (
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
                    className={iconButtonClass}
                  >
                    <ExternalLink size={14} aria-hidden />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void logout()}
                  aria-label="Sign out"
                  title="Sign out"
                  className={iconButtonClass}
                >
                  <LogOut size={14} aria-hidden />
                </button>
              </div>
            ))}
        </aside>

        <main id="main-content" className="min-w-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      <CommandPalette />
      <ShortcutsDialog />
      <HostKeyDialog />
    </div>
  )
}
