import { useState } from 'react'
import {
  Bell,
  KeyRound,
  Link as LinkIcon,
  Palette,
  Settings as SettingsIcon,
  Sparkles,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuth } from '@/stores/auth'
import { AiSettingsTab } from './AiSettingsTab'
import { AccountTab } from './AccountTab'
import { AppearanceTab } from './AppearanceTab'
import { ConnectionTab } from './ConnectionTab'
import { StubTab } from './StubTab'

type SettingsTabId =
  | 'connection'
  | 'account'
  | 'ai'
  | 'appearance'
  | 'keys'
  | 'notifications'
  | 'advanced'

type SettingsTab = {
  id: SettingsTabId
  label: string
  icon: LucideIcon
  description: string
  /** Whether the tab has a real implementation. Stubs render a "coming soon" panel. */
  ready: boolean
  /** True when the tab requires a Spatie permission the user might not hold. */
  permission?: string
}

const TABS: ReadonlyArray<SettingsTab> = [
  {
    id: 'connection',
    label: 'Connection',
    icon: LinkIcon,
    description: 'Server URL and reachability checks.',
    ready: true,
  },
  {
    id: 'account',
    label: 'Account',
    icon: ShieldCheck,
    description: 'Two-factor authentication and master password rotation.',
    ready: true,
  },
  {
    id: 'ai',
    label: 'AI',
    icon: Sparkles,
    description: 'Bring-your-own provider, endpoint, model and feature toggles.',
    ready: true,
    permission: 'ai.use',
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: Palette,
    description: 'Theme, fonts, terminal palette.',
    ready: true,
  },
  {
    id: 'keys',
    label: 'Shortcuts',
    icon: KeyRound,
    description: 'Keybindings - Phase 9.',
    ready: false,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    description: 'Desktop + audit-log notifications - Phase 9.',
    ready: false,
  },
  {
    id: 'advanced',
    label: 'Advanced',
    icon: SettingsIcon,
    description: 'Diagnostics, telemetry, experimental flags - Phase 9.',
    ready: false,
  },
]

export function SettingsPage() {
  const [active, setActive] = useState<SettingsTabId>('connection')
  const hasPermission = useAuth((s) => s.hasPermission)

  const visibleTabs = TABS.filter(
    (tab) => tab.permission === undefined || hasPermission(tab.permission),
  )
  const activeTab = visibleTabs.find((tab) => tab.id === active) ?? visibleTabs[0]

  return (
    <div className="grid h-full min-h-0 grid-cols-[220px_1fr] bg-bg">
      <aside className="flex flex-col gap-1 border-r border-border bg-bg-elev p-3">
        <div className="px-2 pb-2 text-[11px] uppercase tracking-wide text-fg-faint">Settings</div>
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={cn(
              'flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-[13px] transition-colors',
              activeTab?.id === tab.id
                ? 'bg-surface-3 text-fg'
                : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            <tab.icon size={14} className="shrink-0" />
            <span className="truncate">{tab.label}</span>
          </button>
        ))}
      </aside>

      <main className="min-h-0 overflow-auto">
        {activeTab !== undefined && activeTab.ready ? (
          <ActiveTabContent id={activeTab.id} />
        ) : activeTab !== undefined ? (
          <StubTab title={activeTab.label} body={activeTab.description} />
        ) : null}
      </main>
    </div>
  )
}

function ActiveTabContent({ id }: { id: SettingsTabId }) {
  switch (id) {
    case 'connection':
      return <ConnectionTab />
    case 'account':
      return <AccountTab />
    case 'ai':
      return <AiSettingsTab />
    case 'appearance':
      return <AppearanceTab />
    default:
      return null
  }
}
