import { Badge } from '../components/Badge'
import { MobileBg, StatusSpacer } from '../components/MobileBg'
import { MobileHeader } from '../components/MobileHeader'
import { MobileIcon, type MobileIconName } from '../components/MobileIcon'
import { MobileLogo } from '../components/MobileLogo'

const ACTIONS: ReadonlyArray<{ icon: MobileIconName; label: string; color: string }> = [
  { icon: 'terminal', label: 'Terminal', color: '#7dd3a0' },
  { icon: 'folder', label: 'SFTP', color: '#7aa2f7' },
  { icon: 'code', label: 'Snippet', color: '#e0b870' },
  { icon: 'tunnel', label: 'Tunnel', color: '#c897e0' },
]

const ROWS: ReadonlyArray<{
  icon: MobileIconName
  label: string
  value: string
  mono?: boolean
}> = [
  { icon: 'key', label: 'Identity', value: 'acme-deploy', mono: true },
  { icon: 'bolt', label: 'Initial command', value: 'tail -f log/prod', mono: true },
  { icon: 'tag', label: 'Tags', value: 'nginx · us-east' },
  { icon: 'shield', label: 'Fingerprint', value: 'SHA256:7Hd9k3…', mono: true },
]

export function HostSheetScreen({
  onOpenTerminal,
  onClose,
}: {
  onOpenTerminal?: () => void
  onClose?: () => void
}) {
  return (
    <MobileBg>
      <StatusSpacer />
      {/* dimmed list behind */}
      <div style={{ padding: '0 16px', opacity: 0.35, pointerEvents: 'none' }}>
        <MobileHeader title="Hosts" sub="14 hosts" leading={<MobileLogo size={13} />} />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{ height: 60, background: '#1c1a14', borderRadius: 14, marginBottom: 8 }}
          />
        ))}
      </div>
      {/* dim overlay */}
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
      />
      {/* sheet */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          background: '#15140f',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingTop: 8,
          paddingBottom: 40,
          borderTop: '0.5px solid rgba(255,255,255,0.10)',
        }}
      >
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.2)',
            margin: '0 auto 14px',
          }}
        />
        <div
          style={{
            padding: '0 18px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            borderBottom: '0.5px solid rgba(255,255,255,0.06)',
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#f17a7a22',
              color: '#f17a7a',
              border: '1px solid #f17a7a40',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MobileIcon name="server" size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>web-01.prod</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#a39d8a' }}>
              deploy@10.0.4.21:22
            </div>
          </div>
          <Badge tone="accent" dot>
            connected
          </Badge>
        </div>
        <div
          style={{
            padding: 12,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
          }}
        >
          {ACTIONS.map((a) => (
            <button
              key={a.label}
              onClick={a.label === 'Terminal' ? onOpenTerminal : undefined}
              style={{
                background: '#1c1a14',
                borderRadius: 12,
                padding: '12px 6px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                border: '0.5px solid rgba(255,255,255,0.05)',
                color: 'inherit',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: a.color + '22',
                  color: a.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MobileIcon name={a.icon} size={17} />
              </div>
              <span style={{ fontSize: 11, color: '#e7e2d4' }}>{a.label}</span>
            </button>
          ))}
        </div>
        <div style={{ padding: '4px 14px' }}>
          {ROWS.map((r, i) => (
            <div
              key={r.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 4px',
                borderBottom: i < ROWS.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none',
              }}
            >
              <MobileIcon name={r.icon} size={16} color="#a39d8a" />
              <span style={{ fontSize: 14, color: '#a39d8a', flex: 1 }}>{r.label}</span>
              <span
                style={{
                  fontFamily: r.mono ? 'var(--font-mono)' : 'inherit',
                  fontSize: 13,
                  color: '#e7e2d4',
                }}
              >
                {r.value}
              </span>
              <MobileIcon name="chevron_right" size={14} color="#4a463a" />
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 14px 0' }}>
          <button
            onClick={onOpenTerminal}
            style={{
              width: '100%',
              height: 50,
              borderRadius: 14,
              border: 'none',
              background: '#7dd3a0',
              color: '#0a0c0a',
              fontSize: 16,
              fontWeight: 600,
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            <MobileIcon name="terminal" size={17} /> Open terminal
          </button>
        </div>
      </div>
    </MobileBg>
  )
}
