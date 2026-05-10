import { MobileIcon, type MobileIconName } from './MobileIcon'

export type TabId = 'hosts' | 'snippets' | 'sftp' | 'settings'

const tabs: ReadonlyArray<{ id: TabId; icon: MobileIconName; label: string }> = [
  { id: 'hosts', icon: 'server', label: 'Hosts' },
  { id: 'snippets', icon: 'code', label: 'Snippets' },
  { id: 'sftp', icon: 'folder', label: 'Files' },
  { id: 'settings', icon: 'settings', label: 'Settings' },
]

export function TabBar({ active, onChange }: { active?: TabId; onChange?: (id: TabId) => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: 30,
        paddingTop: 8,
        background: 'rgba(20,18,14,0.85)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: '0.5px solid rgba(255,255,255,0.06)',
        display: 'flex',
        justifyContent: 'space-around',
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange?.(t.id)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            color: active === t.id ? '#7dd3a0' : '#6e6957',
            background: 'transparent',
            border: 'none',
            padding: '4px 12px',
            cursor: 'pointer',
          }}
        >
          <MobileIcon name={t.icon} size={22} />
          <span style={{ fontSize: 10, fontWeight: 500 }}>{t.label}</span>
        </button>
      ))}
    </div>
  )
}
