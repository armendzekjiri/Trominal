import { Code2, FolderSync, KeyRound, Server, Settings, Terminal, Workflow } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ShortcutId } from '@/lib/shortcuts'

export type NavItem = {
  to: string
  label: string
  permission: string
  icon: LucideIcon
  shortcut: ShortcutId
}

/** Primary sections, in sidebar order. ⌘1–6 follow this order. */
export const NAV_ITEMS: ReadonlyArray<NavItem> = [
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

/** Icon and label for the section a path belongs to; Settings included. */
export function sectionFor(pathname: string): { label: string; icon: LucideIcon } {
  if (pathname.startsWith('/settings')) return { label: 'Settings', icon: Settings }
  const item = NAV_ITEMS.find((nav) => pathname.startsWith(nav.to))
  return item ?? NAV_ITEMS[0]
}
