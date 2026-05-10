import { Badge } from '../components/Badge'
import { MobileBg, StatusSpacer } from '../components/MobileBg'
import { MobileHeader } from '../components/MobileHeader'
import { MobileIcon } from '../components/MobileIcon'
import { MobileLogo } from '../components/MobileLogo'
import { TabBar, type TabId } from '../components/TabBar'

const SNIPPETS: ReadonlyArray<{ name: string; desc: string; tag: string; color: string }> = [
  {
    name: 'k8s · pod logs',
    desc: 'kubectl logs -n {{ns}} -l app={{app}}',
    tag: 'k8s',
    color: '#7aa2f7',
  },
  {
    name: 'psql · active sessions',
    desc: 'SELECT state, count(*) FROM pg_stat_activity',
    tag: 'db',
    color: '#e0b870',
  },
  {
    name: 'nginx · reload',
    desc: 'sudo systemctl reload nginx',
    tag: 'ops',
    color: '#7dd3a0',
  },
  {
    name: 'docker · prune',
    desc: 'docker system prune -af --volumes',
    tag: 'docker',
    color: '#7aa2f7',
  },
  {
    name: 'tail prod log',
    desc: 'tail -f /srv/app/log/production.log',
    tag: 'ops',
    color: '#7dd3a0',
  },
  { name: 'redis · flush', desc: 'redis-cli FLUSHDB', tag: 'db', color: '#e0b870' },
  {
    name: 'ssh · port forward',
    desc: 'ssh -L 5432:db.acme:5432 bastion',
    tag: 'net',
    color: '#c897e0',
  },
]

export function SnippetsScreen({ onTabChange }: { onTabChange?: (id: TabId) => void }) {
  return (
    <MobileBg>
      <StatusSpacer />
      <MobileHeader
        title="Snippets"
        sub="8 snippets · synced"
        leading={<MobileLogo size={13} />}
        trailing={
          <>
            <MobileIcon name="filter" size={20} color="#7dd3a0" />
            <MobileIcon name="plus" size={22} color="#7dd3a0" />
          </>
        }
        search="Search snippets, tags…"
      />
      <div
        style={{
          padding: '0 16px 100px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {SNIPPETS.map((s) => (
          <div
            key={s.name}
            style={{
              background: '#1c1a14',
              borderRadius: 12,
              padding: 12,
              border: '0.5px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: s.color + '22',
                color: s.color,
                border: `1px solid ${s.color}40`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <MobileIcon name="code" size={14} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{s.name}</span>
                <Badge tone="outline" mono>
                  {s.tag}
                </Badge>
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: '#a39d8a',
                  marginTop: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.desc}
              </div>
            </div>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: 'rgba(125,211,160,0.14)',
                color: '#7dd3a0',
                border: '1px solid rgba(125,211,160,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <MobileIcon name="play" size={12} />
            </div>
          </div>
        ))}
      </div>
      <TabBar active="snippets" onChange={onTabChange} />
    </MobileBg>
  )
}
