import type { ReactNode } from 'react'
import { Badge } from '../components/Badge'
import { MobileBg, StatusSpacer } from '../components/MobileBg'
import { MobileHeader } from '../components/MobileHeader'
import { MobileIcon, type MobileIconName } from '../components/MobileIcon'
import { MobileLogo } from '../components/MobileLogo'
import { TabBar, type TabId } from '../components/TabBar'
import { Toggle } from '../components/Toggle'

function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      {title && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#a39d8a',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            padding: '0 4px 8px',
          }}
        >
          {title}
        </div>
      )}
      <div
        style={{
          background: '#1c1a14',
          borderRadius: 14,
          border: '0.5px solid rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function Row({
  icon,
  color = '#7dd3a0',
  label,
  value,
  last,
  toggle,
  on,
}: {
  icon?: MobileIconName
  color?: string
  label: string
  value?: string
  last?: boolean
  toggle?: boolean
  on?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 14px',
        borderBottom: last ? 'none' : '0.5px solid rgba(255,255,255,0.05)',
      }}
    >
      {icon && (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: color + '22',
            color: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MobileIcon name={icon} size={14} />
        </div>
      )}
      <span style={{ flex: 1, fontSize: 15 }}>{label}</span>
      {value && <span style={{ fontSize: 13, color: '#6e6957' }}>{value}</span>}
      {toggle ? <Toggle on={on} /> : <MobileIcon name="chevron_right" size={14} color="#4a463a" />}
    </div>
  )
}

export function MobileSettingsScreen({ onTabChange }: { onTabChange?: (id: TabId) => void }) {
  return (
    <MobileBg>
      <StatusSpacer />
      <MobileHeader title="Settings" leading={<MobileLogo size={13} />} />
      <div style={{ padding: '0 16px 100px' }}>
        {/* account card */}
        <div
          style={{
            background: '#1c1a14',
            borderRadius: 14,
            padding: 14,
            border: '0.5px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 11,
              background: '#24211a',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600 }}>
              RM
            </span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 500 }}>riley@acme.io</div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: '#6e6957',
                marginTop: 2,
              }}
            >
              trominal.acme.internal
            </div>
          </div>
          <Badge tone="accent" dot>
            synced
          </Badge>
        </div>

        <Group title="Vault">
          <Row icon="lock" label="Auto-lock" value="15 min" />
          <Row icon="shield" color="#7aa2f7" label="Face ID" toggle on />
          <Row icon="key" color="#e0b870" label="Identities" value="4 keys" />
          <Row icon="power" color="#f17a7a" label="Lock now" last />
        </Group>

        <Group title="AI">
          <Row icon="sparkles" label="Provider" value="Anthropic" />
          <Row icon="bolt" color="#e0b870" label="Inline ghost text" toggle on />
          <Row icon="terminal" color="#7aa2f7" label="Send terminal context" toggle />
          <Row icon="more" label="Model" value="claude-sonnet-4.5" last />
        </Group>

        <Group title="Appearance">
          <Row icon="monitor" label="Theme" value="Dark" color="#c897e0" />
          <Row icon="code" color="#7aa2f7" label="Terminal font" value="JetBrains Mono" />
          <Row icon="filter" color="#e0b870" label="Color scheme" value="Trominal" last />
        </Group>

        <Group title="Connection">
          <Row icon="server" label="Server" value="acme.internal" />
          <Row icon="refresh" color="#7aa2f7" label="Sync" value="2m ago" />
          <Row icon="power" color="#f17a7a" label="Sign out" last />
        </Group>
      </div>
      <TabBar active="settings" onChange={onTabChange} />
    </MobileBg>
  )
}
