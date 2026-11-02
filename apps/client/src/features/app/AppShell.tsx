import {
  Code2,
  ExternalLink,
  FolderSync,
  KeyRound,
  Lock,
  LogOut,
  Settings,
  Server,
  Terminal,
  Workflow,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { Logo } from '@/components/branding/logo'
import { TeamScopeSwitcher } from '@/features/teams/TeamScopeSwitcher'
import { cn } from '@/lib/cn'
import { getApiBaseUrl } from '@/lib/config'
import { openExternal } from '@/lib/open-external'
import { useAuth } from '@/stores/auth'
import { useVault } from '@/stores/vault'

type NavItem = {
  to: string
  label: string
  permission: string
  icon: LucideIcon
}

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { to: '/hosts', label: 'Hosts', permission: 'hosts.read', icon: Server },
  { to: '/terminal', label: 'Terminal', permission: 'hosts.connect', icon: Terminal },
  { to: '/snippets', label: 'Snippets', permission: 'snippets.read', icon: Code2 },
  { to: '/identities', label: 'Identities', permission: 'identities.read', icon: KeyRound },
  { to: '/tunnels', label: 'Tunnels', permission: 'tunnels.read', icon: Workflow },
  { to: '/sftp', label: 'SFTP', permission: 'sftp.read', icon: FolderSync },
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

async function openAdminPanel(): Promise<void> {
  const base = await getApiBaseUrl()
  if (base === null || base === '') return
  await openExternal(new URL('/admin', base).toString())
}

export function AppShell() {
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const lock = useVault((s) => s.lock)
  const hasPermission = useAuth((s) => s.hasPermission)
  const isAdmin = user?.roles.includes('admin') ?? false

  return (
    <div className="grid h-full grid-cols-[224px_1fr]">
      <aside className="flex min-h-0 flex-col gap-3 border-r border-border bg-bg-elev px-3 pb-3 pt-4">
        <div className="px-2.5">
          <Logo />
        </div>

        <TeamScopeSwitcher />

        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {NAV_ITEMS.filter((item) => hasPermission(item.permission)).map((item) => (
            <NavLink key={item.to} to={item.to} className={navRowClass}>
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
          <NavLink to="/settings" className={navRowClass}>
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
    </div>
  )
}
