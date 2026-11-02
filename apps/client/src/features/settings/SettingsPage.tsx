import { useSearchParams } from 'react-router-dom'
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
import { Kbd } from '@/components/ui/kbd'
import { ShortcutList } from '@/features/app/ShortcutList'
import { cn } from '@/lib/cn'
import { useAuth } from '@/stores/auth'
import { AdvancedTab } from './AdvancedTab'
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
  | 'shortcuts'
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
    id: 'shortcuts',
    label: 'Shortcuts',
    icon: KeyRound,
    description: 'Every keyboard shortcut in the app.',
    ready: true,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    description: 'Desktop and audit-log notifications are planned for a later release.',
    ready: false,
  },
  {
    id: 'advanced',
    label: 'Advanced',
    icon: SettingsIcon,
    description: 'Desktop updater and release diagnostics.',
    ready: true,
  },
]

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const active = searchParams.get('tab') ?? 'connection'
  const setActive = (id: SettingsTabId) => setSearchParams({ tab: id }, { replace: true })
  const hasPermission = useAuth((s) => s.hasPermission)

  const visibleTabs = TABS.filter(
    (tab) => tab.permission === undefined || hasPermission(tab.permission),
  )
  const activeTab = visibleTabs.find((tab) => tab.id === active) ?? visibleTabs[0]

  return (
    <div className="grid h-full min-h-0 grid-cols-[220px_1fr] bg-bg">
      <nav
        aria-label="Settings"
        className="flex flex-col gap-0.5 border-r border-border bg-bg-elev p-3"
      >
        <h1 className="px-2.5 pb-3 pt-1 text-[15px] font-semibold text-fg">Settings</h1>
        {visibleTabs.map((tab) => {
          const isActive = activeTab?.id === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'group flex h-[34px] items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] font-medium transition-colors',
                isActive
                  ? 'bg-accent-soft text-fg'
                  : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
              )}
            >
              <tab.icon
                size={15}
                aria-hidden
                className={cn(
                  'shrink-0',
                  isActive ? 'text-accent' : 'text-fg-faint group-hover:text-fg',
                )}
              />
              <span className="flex-1 truncate">{tab.label}</span>
              {!tab.ready && (
                <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] text-fg-faint">
                  Soon
                </span>
              )}
            </button>
          )
        })}
      </nav>

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
    case 'shortcuts':
      return (
        <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
          <header>
            <h1 className="text-[18px] font-semibold">Keyboard shortcuts</h1>
            <p className="mt-1 text-[12px] text-fg-muted">
              Press <Kbd id="palette" /> anywhere for the command palette, or <Kbd id="help" /> to
              see this list.
            </p>
          </header>
          <ShortcutList />
        </div>
      )
    case 'advanced':
      return <AdvancedTab />
    default:
      return null
  }
}
