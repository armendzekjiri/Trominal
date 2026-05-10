import { Badge } from '../components/Badge'
import { MobileBg, StatusSpacer } from '../components/MobileBg'
import { MobileIcon } from '../components/MobileIcon'
import { MobileLogo } from '../components/MobileLogo'

export function UnlockScreen() {
  return (
    <MobileBg>
      <StatusSpacer />
      <div
        style={{
          height: 'calc(100% - 60px - 34px)',
          display: 'flex',
          flexDirection: 'column',
          padding: 24,
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 28,
          }}
        >
          <MobileLogo size={17} />
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              background: 'rgba(125,211,160,0.10)',
              border: '1px solid rgba(125,211,160,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <MobileIcon name="lock" size={36} color="#7dd3a0" />
            <div
              style={{
                position: 'absolute',
                inset: 12,
                borderRadius: 18,
                border: '1px dashed rgba(125,211,160,0.35)',
              }}
            />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>
              Vault locked
            </div>
            <div
              style={{
                fontSize: 14,
                color: '#a39d8a',
                marginTop: 6,
                lineHeight: 1.45,
              }}
            >
              Use Face ID to unlock your hosts,
              <br />
              snippets, and identities.
            </div>
          </div>
          <Badge tone="outline" mono>
            trominal.acme.internal · riley@acme.io
          </Badge>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            style={{
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
            }}
          >
            <MobileIcon name="unlock" size={17} /> Unlock with Face ID
          </button>
          <button
            style={{
              height: 44,
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'transparent',
              color: '#a39d8a',
              fontSize: 14,
              fontFamily: 'inherit',
            }}
          >
            Use master password
          </button>
        </div>
      </div>
    </MobileBg>
  )
}
