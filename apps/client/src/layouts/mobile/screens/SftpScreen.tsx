import { Badge } from '../components/Badge'
import { MobileBg, StatusSpacer } from '../components/MobileBg'
import { MobileDot } from '../components/MobileDot'
import { MobileHeader } from '../components/MobileHeader'
import { MobileIcon } from '../components/MobileIcon'
import { TabBar, type TabId } from '../components/TabBar'

const FILES: ReadonlyArray<{
  name: string
  icon: 'folder' | 'file'
  size: string
  date: string
  badge?: string
}> = [
  { name: '..', icon: 'folder', size: '—', date: '' },
  { name: 'config', icon: 'folder', size: '—', date: 'Apr 11' },
  { name: 'log', icon: 'folder', size: '—', date: 'today', badge: '2 new' },
  { name: 'public', icon: 'folder', size: '—', date: 'May 01' },
  { name: 'Gemfile', icon: 'file', size: '2.1 KB', date: 'Apr 11' },
  { name: 'Gemfile.lock', icon: 'file', size: '14.2 KB', date: 'Apr 11' },
  { name: 'README.md', icon: 'file', size: '3.4 KB', date: 'Mar 02' },
  { name: 'config.ru', icon: 'file', size: '284 B', date: 'Jan 14' },
  { name: '.env.production', icon: 'file', size: '1.1 KB', date: 'Apr 22' },
]

export function SftpScreen({ onTabChange }: { onTabChange?: (id: TabId) => void }) {
  return (
    <MobileBg>
      <StatusSpacer />
      <MobileHeader
        title="Files"
        leading={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MobileIcon name="chevron_left" size={20} color="#7dd3a0" />
            <span style={{ fontSize: 14, color: '#7dd3a0' }}>web-01.prod</span>
          </div>
        }
        trailing={
          <>
            <MobileIcon name="upload" size={20} color="#7dd3a0" />
            <MobileIcon name="more" size={20} color="#7dd3a0" />
          </>
        }
        large={false}
      />
      <div style={{ padding: '0 16px 16px' }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            padding: '8px 12px',
            background: '#1c1a14',
            borderRadius: 10,
            fontSize: 12,
            color: '#a39d8a',
            border: '0.5px solid rgba(255,255,255,0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <MobileDot state="connected" size={6} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>/srv/app</span>
          <MobileIcon name="refresh" size={13} />
        </div>
      </div>
      <div style={{ padding: '0 16px 100px' }}>
        <div
          style={{
            background: '#1c1a14',
            borderRadius: 14,
            border: '0.5px solid rgba(255,255,255,0.06)',
            overflow: 'hidden',
          }}
        >
          {FILES.map((f, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                borderBottom: i < FILES.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none',
              }}
            >
              <MobileIcon
                name={f.icon}
                size={18}
                color={f.icon === 'folder' ? '#7aa2f7' : '#6e6957'}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 14,
                    color: '#e7e2d4',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {f.name}
                </div>
                {f.size !== '—' && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#6e6957' }}>
                    {f.size} · {f.date}
                  </div>
                )}
              </div>
              {f.badge && <Badge tone="accent">{f.badge}</Badge>}
              <MobileIcon name="chevron_right" size={14} color="#4a463a" />
            </div>
          ))}
        </div>
      </div>
      {/* Floating transfer pill */}
      <div
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 100,
          background: 'rgba(20,18,14,0.95)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '0.5px solid rgba(255,255,255,0.10)',
          borderRadius: 14,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'rgba(125,211,160,0.15)',
            color: '#7dd3a0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MobileIcon name="arrow_up_down" size={14} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>2 transfers · 1.8 MB/s</div>
          <div
            style={{
              height: 3,
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 2,
              marginTop: 4,
              overflow: 'hidden',
            }}
          >
            <div style={{ width: '64%', height: '100%', background: '#7dd3a0' }} />
          </div>
        </div>
        <MobileIcon name="chevron_down" size={16} color="#a39d8a" />
      </div>
      <TabBar active="sftp" onChange={onTabChange} />
    </MobileBg>
  )
}
