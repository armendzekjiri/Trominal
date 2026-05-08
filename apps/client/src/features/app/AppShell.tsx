import {
  Code2,
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
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Logo } from '@/components/branding/logo'
import { cn } from '@/lib/cn'
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

export function AppShell() {
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const lock = useVault((s) => s.lock)
  const hasPermission = useAuth((s) => s.hasPermission)

  return (
    <div className="grid h-full grid-cols-[240px_1fr]">
      <aside className="flex flex-col gap-4 border-r border-border bg-bg-elev p-3">
        <div className="px-2 pt-2">
          <Logo />
        </div>

        <nav className="flex flex-col gap-0.5">
          {NAV_ITEMS.filter((item) => hasPermission(item.permission)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-[13px] text-fg-muted transition-colors',
                  isActive ? 'bg-surface-3 text-fg' : 'hover:bg-surface-2 hover:text-fg',
                )
              }
            >
              <item.icon size={14} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-0.5 border-t border-border-subtle pt-3">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-[13px] text-fg-muted transition-colors',
                isActive ? 'bg-surface-3 text-fg' : 'hover:bg-surface-2 hover:text-fg',
              )
            }
          >
            <Settings size={14} />
            Settings
          </NavLink>
          <button
            type="button"
            onClick={lock}
            className="flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-[13px] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <Lock size={14} />
            Lock vault
          </button>
          <button
            type="button"
            onClick={() => {
              void logout()
            }}
            className="flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-[13px] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>

        {user !== null && (
          <div className="rounded-md border border-border-subtle bg-surface px-2.5 py-2 text-[11px] text-fg-faint">
            <div className="truncate font-mono text-fg">{user.email}</div>
            {user.roles.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {user.roles.map((role) => (
                  <span
                    key={role}
                    className="rounded-sm border border-border-subtle bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-fg-muted"
                  >
                    {role}
                  </span>
                ))}
              </div>
            )}
            {user.roles.includes('admin') && (
              <Link
                to={(typeof window !== 'undefined' ? window.location.origin : '') + '/admin'}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-accent hover:underline"
              >
                <Terminal size={11} />
                Open admin panel →
              </Link>
            )}
          </div>
        )}
      </aside>

      <main className="overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
