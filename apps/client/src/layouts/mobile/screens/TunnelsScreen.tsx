import { Badge } from '../components/Badge'
import { MobileBg, StatusSpacer } from '../components/MobileBg'
import { MobileDot } from '../components/MobileDot'
import { MobileHeader } from '../components/MobileHeader'
import { MobileIcon } from '../components/MobileIcon'
import { Toggle } from '../components/Toggle'

type Kind = 'L' | 'R' | 'D'

const TONE: Record<Kind, 'info' | 'warning' | 'accent'> = {
  L: 'info',
  R: 'warning',
  D: 'accent',
}

const TUNNELS: ReadonlyArray<{
  kind: Kind
  local: string
  remote: string
  host: string
  on: boolean
  traffic: string
}> = [
  {
    kind: 'L',
    local: '5432',
    remote: 'db.prod.acme:5432',
    host: 'web-01.prod',
    on: true,
    traffic: '12.4 MB',
  },
  {
    kind: 'L',
    local: '8080',
    remote: 'internal-dash:80',
    host: 'k8s-master',
    on: true,
    traffic: '1.1 MB',
  },
  {
    kind: 'R',
    local: '9000',
    remote: 'localhost:9000',
    host: 'stage-app',
    on: false,
    traffic: '—',
  },
  {
    kind: 'D',
    local: '1080',
    remote: 'SOCKS5 proxy',
    host: 'bastion-eu',
    on: true,
    traffic: '184 MB',
  },
]

export function TunnelsScreen({ onBack }: { onBack?: () => void }) {
  return (
    <MobileBg>
      <StatusSpacer />
      <MobileHeader
        title="Tunnels"
        sub="3 active · 1 stopped"
        leading={
          <button
            onClick={onBack}
            aria-label="Back"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            <MobileIcon name="chevron_left" size={20} color="#7dd3a0" />
          </button>
        }
        trailing={<MobileIcon name="plus" size={22} color="#7dd3a0" />}
      />
      <div
        style={{
          padding: '0 16px 60px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {TUNNELS.map((t, i) => (
          <div
            key={i}
            style={{
              background: '#1c1a14',
              borderRadius: 14,
              padding: 14,
              border: '0.5px solid rgba(255,255,255,0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Badge tone={TONE[t.kind]} mono>
                {t.kind}
              </Badge>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 500 }}>
                :{t.local}
              </span>
              <MobileIcon name="arrow_right" size={14} color="#6e6957" />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: '#a39d8a',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.remote}
              </span>
              <Toggle on={t.on} />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                paddingTop: 10,
                borderTop: '0.5px solid rgba(255,255,255,0.05)',
                fontSize: 11,
                color: '#6e6957',
              }}
            >
              <MobileIcon name="server" size={11} />
              <span style={{ fontFamily: 'var(--font-mono)' }}>via {t.host}</span>
              <span>·</span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: t.on ? '#7dd3a0' : '#6e6957',
                }}
              >
                {t.traffic}
              </span>
              <div style={{ flex: 1 }} />
              <MobileDot state={t.on ? 'connected' : 'idle'} size={6} />
            </div>
          </div>
        ))}
      </div>
    </MobileBg>
  )
}
