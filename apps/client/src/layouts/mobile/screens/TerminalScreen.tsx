import { MobileBg, StatusSpacer } from '../components/MobileBg'
import { MobileDot } from '../components/MobileDot'
import { MobileIcon } from '../components/MobileIcon'
import { TerminalKeyboard } from '../components/TerminalKeyboard'
import { A, TermLine } from '../components/TermLine'

const TABS: ReadonlyArray<{
  name: string
  state: 'connected' | 'connecting' | 'idle'
  active?: boolean
}> = [
  { name: 'web-01.prod', state: 'connected', active: true },
  { name: 'db-primary', state: 'connected' },
  { name: 'k8s-master', state: 'connecting' },
]

export function TerminalScreen({ onBack }: { onBack?: () => void }) {
  return (
    <MobileBg style={{ background: '#0a0907' }}>
      <StatusSpacer />
      {/* mini header */}
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
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            web-01.prod
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#6e6957' }}>
            deploy@10.0.4.21 · 22ms
          </div>
        </div>
        <MobileIcon name="split" size={18} color="#a39d8a" />
        <MobileIcon name="sparkles" size={18} color="#7dd3a0" />
        <MobileIcon name="more" size={18} color="#a39d8a" />
      </div>
      {/* tab strip */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '6px 10px',
          background: '#15140f',
          borderBottom: '0.5px solid rgba(255,255,255,0.04)',
          overflow: 'hidden',
        }}
      >
        {TABS.map((t) => (
          <div
            key={t.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 10px',
              background: t.active ? '#0a0907' : 'transparent',
              borderRadius: 6,
              border: t.active
                ? '0.5px solid rgba(125,211,160,0.3)'
                : '0.5px solid rgba(255,255,255,0.05)',
              fontSize: 11,
            }}
          >
            <MobileDot state={t.state} size={5} />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                color: t.active ? '#e7e2d4' : '#a39d8a',
              }}
            >
              {t.name}
            </span>
          </div>
        ))}
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            background: 'rgba(255,255,255,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#a39d8a',
          }}
        >
          <MobileIcon name="plus" size={13} />
        </div>
      </div>
      {/* terminal body */}
      <div style={{ padding: '10px 12px', overflow: 'hidden' }}>
        <TermLine dim>Last login: Tue May 6 14:22:03 2026</TermLine>
        <TermLine prompt="deploy@web-01:~$">
          <A c="green">cd</A> /srv/app
        </TermLine>
        <TermLine prompt="deploy@web-01:/srv/app$">
          <A c="green">git</A> <A c="cyan">status</A>
        </TermLine>
        <TermLine>
          On branch <A c="bright-green">main</A>
        </TermLine>
        <TermLine>Changes not staged for commit:</TermLine>
        <TermLine>
          {'  '}
          <A c="red">modified: config/database.yml</A>
        </TermLine>
        <TermLine>
          {'  '}
          <A c="red">modified: sessions_controller.rb</A>
        </TermLine>
        <TermLine />
        <TermLine prompt="deploy@web-01:/srv/app$">
          <A c="green">tail</A> -n 4 log/prod.log
        </TermLine>
        <TermLine>
          <A c="bright-black">[14:22:09]</A> <A c="green">INFO</A>
          {'  '}GET /api/v1/users/42 → 200
        </TermLine>
        <TermLine>
          <A c="bright-black">[14:22:11]</A> <A c="yellow">WARN</A>
          {'  '}Slow query (412ms)
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
          }}
        >
          <span style={{ color: '#7dd3a0' }}>deploy@web-01:/srv/app$ </span>
          <span style={{ color: '#c8c2b0' }}>psql -h db</span>
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
