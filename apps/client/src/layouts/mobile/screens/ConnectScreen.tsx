import { MobileBg, StatusSpacer } from '../components/MobileBg'
import { MobileLogo } from '../components/MobileLogo'
import { MobileIcon } from '../components/MobileIcon'

export function ConnectScreen() {
  return (
    <MobileBg>
      <StatusSpacer />
      <div
        style={{
          padding: 24,
          height: 'calc(100% - 60px - 34px)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ marginBottom: 32, marginTop: 12 }}>
          <MobileLogo size={16} />
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
          }}
        >
          Connect to your
          <br />
          Trominal server
        </h1>
        <p style={{ fontSize: 14, color: '#a39d8a', marginTop: 10, lineHeight: 1.5 }}>
          Trominal is self-hosted. Point this app at your server's API URL to sync your hosts and
          snippets.
        </p>
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div
              style={{
                fontSize: 12,
                color: '#a39d8a',
                marginBottom: 6,
                fontWeight: 500,
              }}
            >
              Server URL
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                height: 48,
                padding: '0 14px',
                borderRadius: 12,
                background: '#1c1a14',
                border: '1px solid rgba(255,255,255,0.10)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 14,
              }}
            >
              <MobileIcon name="server" size={16} color="#a39d8a" />
              <span style={{ flex: 1 }}>https://trominal.acme.internal</span>
              <MobileIcon name="x" size={14} color="#6e6957" />
            </div>
          </div>
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 12,
              background: 'rgba(125,211,160,0.10)',
              border: '1px solid rgba(125,211,160,0.18)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <MobileIcon name="check" size={15} color="#7dd3a0" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Reachable · v1.4.2</div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: '#a39d8a',
                  marginTop: 2,
                }}
              >
                tls 1.3 · 38 ms
              </div>
            </div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            style={{
              height: 52,
              borderRadius: 14,
              border: 'none',
              background: '#7dd3a0',
              color: '#0a0c0a',
              fontSize: 16,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            Continue
          </button>
          <button
            style={{
              height: 48,
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'transparent',
              color: '#e7e2d4',
              fontSize: 14,
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <MobileIcon name="bolt" size={15} color="#7dd3a0" /> Use Trominal Cloud (beta)
          </button>
        </div>
      </div>
    </MobileBg>
  )
}
