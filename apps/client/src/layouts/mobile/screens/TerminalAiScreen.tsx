import { MobileBg, StatusSpacer } from '../components/MobileBg'
import { MobileDot } from '../components/MobileDot'
import { MobileIcon } from '../components/MobileIcon'
import { TerminalKeyboard } from '../components/TerminalKeyboard'
import { A, TermLine } from '../components/TermLine'

export function TerminalAiScreen({ onBack }: { onBack?: () => void }) {
  return (
    <MobileBg style={{ background: '#0a0907' }}>
      <StatusSpacer />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 12px',
          gap: 10,
          borderBottom: '0.5px solid rgba(255,255,255,0.06)',
          background: '#15140f',
        }}
      >
        <button
          onClick={onBack}
          aria-label="Back"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <MobileIcon name="chevron_left" size={20} color="#7dd3a0" />
        </button>
        <MobileDot state="connected" size={7} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500 }}>
            web-01.prod
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#6e6957' }}>
            deploy@10.0.4.21 · AI ready
          </div>
        </div>
        <MobileIcon name="sparkles" size={18} color="#7dd3a0" />
        <MobileIcon name="more" size={18} color="#a39d8a" />
      </div>
      {/* AI bubble */}
      <div
        style={{
          margin: '10px 12px 4px',
          padding: '10px 12px',
          background: 'rgba(125,211,160,0.08)',
          border: '1px solid rgba(125,211,160,0.2)',
          borderRadius: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <MobileIcon name="sparkles" size={12} color="#7dd3a0" />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#7dd3a0' }}>Trominal AI</span>
          <span style={{ fontSize: 11, color: '#6e6957' }}>· based on your last command</span>
        </div>
        <div style={{ fontSize: 13, color: '#e7e2d4', lineHeight: 1.5 }}>
          Postgres has hit max_connections. Try counting active sessions first:
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            marginTop: 8,
            padding: '8px 10px',
            background: '#0a0907',
            border: '0.5px solid rgba(255,255,255,0.06)',
            borderRadius: 6,
            fontSize: 12,
            color: '#c8c2b0',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <A c="green">SELECT</A> state, <A c="cyan">count</A>(*) FROM pg_stat_activity GROUP BY
            state;
          </span>
          <MobileIcon name="copy" size={13} color="#a39d8a" />
          <MobileIcon name="terminal" size={13} color="#7dd3a0" />
        </div>
      </div>
      <div style={{ padding: '6px 12px' }}>
        <TermLine prompt="deploy@web-01:/srv/app$">
          <A c="green">tail</A> -n 2 log/prod.log
        </TermLine>
        <TermLine>
          <A c="bright-black">[14:22:14]</A> <A c="red">ERROR</A> Postgres: too many connections
        </TermLine>
        <TermLine />
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: '#7dd3a0' }}>deploy@web-01:/srv/app$ </span>
          <span style={{ color: '#c8c2b0' }}>psql </span>
          <span style={{ color: '#4a463a', fontStyle: 'italic' }}>-h db.prod.acme -U postgres</span>
          <span
            style={{
              width: 7,
              height: 14,
              background: '#7dd3a0',
              marginLeft: 1,
              animation: 'tr-blink 1s step-end infinite',
            }}
          />
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: '#6e6957',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <MobileIcon name="sparkles" size={11} color="#7dd3a0" />
          ghost suggestion ·
          <span
            style={{
              padding: '1px 6px',
              borderRadius: 4,
              background: 'rgba(255,255,255,0.06)',
              color: '#e7e2d4',
            }}
          >
            tab
          </span>
          accept ·
          <span
            style={{
              padding: '1px 6px',
              borderRadius: 4,
              background: 'rgba(255,255,255,0.06)',
              color: '#e7e2d4',
            }}
          >
            esc
          </span>
          dismiss
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingBottom: 8,
        }}
      >
        <TerminalKeyboard />
      </div>
    </MobileBg>
  )
}
