import { MobileBg, StatusSpacer } from '../components/MobileBg'
import { MobileDot } from '../components/MobileDot'
import { MobileHeader } from '../components/MobileHeader'
import { MobileIcon } from '../components/MobileIcon'
import { MobileLogo } from '../components/MobileLogo'
import { TabBar, type TabId } from '../components/TabBar'

type HostState = 'connected' | 'idle' | 'error'

const groups: ReadonlyArray<{
  name: string
  count: number
  color: string
  hosts: ReadonlyArray<{ name: string; addr: string; state: HostState; last: string }>
}> = [
  {
    name: 'Production',
    count: 4,
    color: '#f17a7a',
    hosts: [
      { name: 'web-01.prod', addr: 'deploy@10.0.4.21', state: 'connected', last: 'Connected' },
      { name: 'web-02.prod', addr: 'deploy@10.0.4.22', state: 'connected', last: '14m ago' },
      { name: 'db-primary', addr: 'postgres@db.prod.acme', state: 'idle', last: 'Yesterday' },
    ],
  },
  {
    name: 'Staging',
    count: 2,
    color: '#e0b870',
    hosts: [
      { name: 'stage-app', addr: 'ubuntu@stage.acme.io', state: 'idle', last: '3d ago' },
      { name: 'stage-worker', addr: 'ubuntu@10.1.2.4', state: 'error', last: 'Auth failed' },
    ],
  },
  {
    name: 'Personal',
    count: 1,
    color: '#c897e0',
    hosts: [{ name: 'homelab-nas', addr: 'riley@192.168.1.42', state: 'idle', last: 'Last week' }],
  },
]

export function HostsScreen({
  onOpenHost,
  onTabChange,
}: {
  onOpenHost?: () => void
  onTabChange?: (id: TabId) => void
}) {
  return (
    <MobileBg>
      <StatusSpacer />
      <MobileHeader
        title="Hosts"
        sub="14 hosts · 2 connected"
        leading={<MobileLogo size={13} />}
        trailing={
          <>
            <MobileIcon name="filter" size={20} color="#7dd3a0" />
            <MobileIcon name="plus" size={22} color="#7dd3a0" />
          </>
        }
        search="Search hosts, tags, addresses"
      />
      <div style={{ padding: '0 16px 100px' }}>
        {groups.map((g) => (
          <div key={g.name} style={{ marginBottom: 18 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 4px 8px',
                fontSize: 11,
                fontWeight: 600,
                color: '#a39d8a',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: g.color,
                }}
              />
              {g.name}
              <span style={{ color: '#6e6957', fontWeight: 400 }}>· {g.count}</span>
            </div>
            <div
              style={{
                background: '#1c1a14',
                borderRadius: 14,
                border: '0.5px solid rgba(255,255,255,0.06)',
                overflow: 'hidden',
              }}
            >
              {g.hosts.map((h, i) => (
                <button
                  key={h.name}
                  onClick={onOpenHost}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderBottom:
                      i < g.hosts.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none',
                    background: 'transparent',
                    border: 'none',
                    borderTop: 'none',
                    borderLeft: 'none',
                    borderRight: 'none',
                    color: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      background: g.color + '22',
                      color: g.color,
                      border: `1px solid ${g.color}40`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MobileIcon name="server" size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 15, fontWeight: 500 }}>{h.name}</span>
                      <MobileDot state={h.state} size={7} />
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        color: '#6e6957',
                        marginTop: 1,
                      }}
                    >
                      {h.addr}
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 11, color: '#6e6957' }}>{h.last}</span>
                    <MobileIcon name="chevron_right" size={14} color="#4a463a" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <TabBar active="hosts" onChange={onTabChange} />
    </MobileBg>
  )
}
