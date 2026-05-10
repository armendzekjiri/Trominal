/* Trominal Mobile — all screens.
 * iPhone 14 Pro frame (402×874). Dark-first.
 * Star feature: a custom terminal keyboard purpose-built for SSH.
 */

const { Icon, Badge, Dot, Button, Logo, Input, Toggle, Kbd } = trPrim

// ───── shared chrome ─────
const PHONE_W = 402
const PHONE_H = 874

// Wrap a mobile screen in the iPhone bezel. The artboards are 460×920;
// the device is 402×874 and gets centered.
const Phone = ({ children }) => (
  <div
    style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <IOSDevice width={PHONE_W} height={PHONE_H} dark>
      {children}
    </IOSDevice>
  </div>
)

// Mobile background — fills the IOSDevice content area, relatively positioned
// so child position:absolute (tab bar, sheets, keyboard) anchor here.
const MobileBg = ({ children, style }) => (
  <div
    style={{
      position: 'relative',
      width: '100%',
      minHeight: '100%',
      height: '100%',
      background: '#0e0d0b',
      color: '#e7e2d4',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 14,
      overflow: 'hidden',
      ...style,
    }}
  >
    {children}
  </div>
)

// Status spacer (below dynamic island)
const StatusSpacer = () => <div style={{ height: 60 }} />

// Bottom tab bar
const TabBar = ({ active = 'hosts' }) => {
  const tabs = [
    { id: 'hosts', icon: 'server', label: 'Hosts' },
    { id: 'snippets', icon: 'code', label: 'Snippets' },
    { id: 'sftp', icon: 'folder', label: 'Files' },
    { id: 'settings', icon: 'settings', label: 'Settings' },
  ]
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
        <div
          key={t.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            color: active === t.id ? '#7dd3a0' : '#6e6957',
          }}
        >
          <Icon name={t.icon} size={22} />
          <span style={{ fontSize: 10, fontWeight: 500 }}>{t.label}</span>
        </div>
      ))}
    </div>
  )
}

// Large iOS-style title header
const MobileHeader = ({ title, sub, leading, trailing, search, large = true }) => (
  <div>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 16px 8px',
        gap: 8,
        height: 44,
      }}
    >
      {leading}
      <div style={{ flex: 1 }} />
      {trailing}
    </div>
    {large && (
      <div style={{ padding: '4px 20px 12px' }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>
          {title}
        </h1>
        {sub && <div style={{ fontSize: 13, color: '#a39d8a', marginTop: 2 }}>{sub}</div>}
      </div>
    )}
    {search && (
      <div style={{ padding: '0 16px 12px' }}>
        <div
          style={{
            height: 36,
            padding: '0 12px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            color: '#6e6957',
          }}
        >
          <Icon name="search" size={15} />
          <span style={{ flex: 1 }}>{search}</span>
        </div>
      </div>
    )}
  </div>
)

// ─────────────────────────────────────────────
// 1. UNLOCK — Face ID
// ─────────────────────────────────────────────
const MobileUnlock = () => (
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
        <Logo size={17} />
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
          <Icon name="lock" size={36} color="#7dd3a0" />
          {/* face id sweep */}
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
          <div style={{ fontSize: 14, color: '#a39d8a', marginTop: 6, lineHeight: 1.45 }}>
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
          <Icon name="unlock" size={17} /> Unlock with Face ID
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

// ─────────────────────────────────────────────
// 2. HOSTS LIST
// ─────────────────────────────────────────────
const MobileHosts = () => {
  const groups = [
    {
      name: 'Production',
      count: 4,
      hosts: [
        { name: 'web-01.prod', addr: 'deploy@10.0.4.21', state: 'connected', last: 'Connected' },
        { name: 'web-02.prod', addr: 'deploy@10.0.4.22', state: 'connected', last: '14m ago' },
        { name: 'db-primary', addr: 'postgres@db.prod.acme', state: 'idle', last: 'Yesterday' },
      ],
      color: '#f17a7a',
    },
    {
      name: 'Staging',
      count: 2,
      hosts: [
        { name: 'stage-app', addr: 'ubuntu@stage.acme.io', state: 'idle', last: '3d ago' },
        { name: 'stage-worker', addr: 'ubuntu@10.1.2.4', state: 'error', last: 'Auth failed' },
      ],
      color: '#e0b870',
    },
    {
      name: 'Personal',
      count: 1,
      hosts: [
        { name: 'homelab-nas', addr: 'riley@192.168.1.42', state: 'idle', last: 'Last week' },
      ],
      color: '#c897e0',
    },
  ]
  return (
    <MobileBg>
      <StatusSpacer />
      <MobileHeader
        title="Hosts"
        sub="14 hosts · 2 connected"
        leading={<Logo size={13} />}
        trailing={
          <>
            <Icon name="filter" size={20} color="#7dd3a0" />
            <Icon name="plus" size={22} color="#7dd3a0" />
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
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: g.color }} />
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
                <div
                  key={h.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderBottom:
                      i < g.hosts.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none',
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
                    <Icon name="server" size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 15, fontWeight: 500 }}>{h.name}</span>
                      <Dot state={h.state} size={7} />
                    </div>
                    <div className="mono" style={{ fontSize: 12, color: '#6e6957', marginTop: 1 }}>
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
                    <Icon name="chevron_right" size={14} color="#4a463a" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <TabBar active="hosts" />
    </MobileBg>
  )
}

// ─────────────────────────────────────────────
// 3. HOST QUICK-ACTIONS SHEET
// ─────────────────────────────────────────────
const MobileHostSheet = () => (
  <MobileBg>
    <StatusSpacer />
    {/* dimmed list behind */}
    <div style={{ padding: '0 16px', opacity: 0.35, pointerEvents: 'none' }}>
      <MobileHeader title="Hosts" sub="14 hosts" leading={<Logo size={13} />} large />
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{ height: 60, background: '#1c1a14', borderRadius: 14, marginBottom: 8 }}
        />
      ))}
    </div>
    {/* dim overlay */}
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
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
          <Icon name="server" size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>web-01.prod</div>
          <div className="mono" style={{ fontSize: 12, color: '#a39d8a' }}>
            deploy@10.0.4.21:22
          </div>
        </div>
        <Badge tone="accent" dot>
          connected
        </Badge>
      </div>
      <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[
          { icon: 'terminal', label: 'Terminal', color: '#7dd3a0' },
          { icon: 'folder', label: 'SFTP', color: '#7aa2f7' },
          { icon: 'code', label: 'Snippet', color: '#e0b870' },
          { icon: 'tunnel', label: 'Tunnel', color: '#c897e0' },
        ].map((a) => (
          <div
            key={a.label}
            style={{
              background: '#1c1a14',
              borderRadius: 12,
              padding: '12px 6px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              border: '0.5px solid rgba(255,255,255,0.05)',
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
              <Icon name={a.icon} size={17} />
            </div>
            <span style={{ fontSize: 11, color: '#e7e2d4' }}>{a.label}</span>
          </div>
        ))}
      </div>
      <div style={{ padding: '4px 14px' }}>
        {[
          { icon: 'key', label: 'Identity', value: 'acme-deploy', mono: true },
          { icon: 'bolt', label: 'Initial command', value: 'tail -f log/prod', mono: true },
          { icon: 'tag', label: 'Tags', value: 'nginx · us-east' },
          { icon: 'shield', label: 'Fingerprint', value: 'SHA256:7Hd9k3…', mono: true },
        ].map((r, i, a) => (
          <div
            key={r.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 4px',
              borderBottom: i < a.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none',
            }}
          >
            <Icon name={r.icon} size={16} color="#a39d8a" />
            <span style={{ fontSize: 14, color: '#a39d8a', flex: 1 }}>{r.label}</span>
            <span className={r.mono ? 'mono' : ''} style={{ fontSize: 13, color: '#e7e2d4' }}>
              {r.value}
            </span>
            <Icon name="chevron_right" size={14} color="#4a463a" />
          </div>
        ))}
      </div>
      <div style={{ padding: '12px 14px 0' }}>
        <button
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
          }}
        >
          <Icon name="terminal" size={17} /> Open terminal
        </button>
      </div>
    </div>
  </MobileBg>
)

// ─────────────────────────────────────────────
// CUSTOM TERMINAL KEYBOARD — the hero
// ─────────────────────────────────────────────
const TermKey = ({ children, flex = 1, w, accent, sub, dim, small, mono = true, h = 40 }) => (
  <div
    style={{
      flex: w ? undefined : flex,
      width: w,
      height: h,
      minWidth: 0,
      background: accent
        ? 'rgba(125,211,160,0.14)'
        : dim
          ? 'rgba(255,255,255,0.04)'
          : 'rgba(255,255,255,0.08)',
      border: `0.5px solid ${accent ? 'rgba(125,211,160,0.35)' : 'rgba(255,255,255,0.10)'}`,
      borderRadius: 7,
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: accent ? '#7dd3a0' : dim ? '#6e6957' : '#e7e2d4',
      fontFamily: mono ? 'var(--font-mono)' : 'inherit',
      fontSize: small ? 11 : 14,
      fontWeight: 500,
      boxShadow: '0 1px 0 rgba(0,0,0,0.3)',
    }}
  >
    {children}
    {sub && (
      <span
        style={{
          position: 'absolute',
          top: 2,
          right: 4,
          fontSize: 9,
          color: '#6e6957',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {sub}
      </span>
    )}
  </div>
)

const TerminalKeyboard = ({ mode = 'default' }) => (
  <div
    style={{
      background: 'rgba(13,12,10,0.94)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      borderTop: '0.5px solid rgba(255,255,255,0.08)',
      paddingTop: 6,
      paddingBottom: 6,
    }}
  >
    {/* Snippet quick bar */}
    <div
      style={{
        display: 'flex',
        gap: 6,
        padding: '6px 8px 8px',
        borderBottom: '0.5px solid rgba(255,255,255,0.05)',
        overflow: 'hidden',
      }}
    >
      {[
        { label: 'ls -la', icon: null },
        { label: 'git status', icon: null },
        { label: 'tail -f', icon: null },
        { label: '↑ history', icon: null, accent: true },
        { label: 'Ask AI', icon: 'sparkles', accent: true },
      ].map((s, i) => (
        <div
          key={i}
          className="mono"
          style={{
            padding: '6px 10px',
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 500,
            background: s.accent ? 'rgba(125,211,160,0.14)' : 'rgba(255,255,255,0.06)',
            color: s.accent ? '#7dd3a0' : '#e7e2d4',
            border: `0.5px solid ${s.accent ? 'rgba(125,211,160,0.35)' : 'rgba(255,255,255,0.08)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            whiteSpace: 'nowrap',
          }}
        >
          {s.icon && <Icon name={s.icon} size={11} />}
          {s.label}
        </div>
      ))}
    </div>

    {/* Modifier + arrow row */}
    <div style={{ display: 'flex', gap: 5, padding: '6px 6px 4px' }}>
      <TermKey small>esc</TermKey>
      <TermKey small>tab</TermKey>
      <TermKey small accent>
        ctrl
      </TermKey>
      <TermKey small>alt</TermKey>
      <TermKey small>⌘</TermKey>
      <TermKey small>{'^C'}</TermKey>
      <TermKey small>{'^D'}</TermKey>
      <div style={{ width: 6 }} />
      <TermKey small w={32}>
        <Icon name="chevron_left" size={13} />
      </TermKey>
      <TermKey small w={32} sub="↑">
        <span style={{ fontSize: 13 }}>▲</span>
      </TermKey>
      <TermKey small w={32}>
        <Icon name="chevron_right" size={13} />
      </TermKey>
    </div>

    {/* Symbol/number row — terminal-tuned */}
    <div style={{ display: 'flex', gap: 5, padding: '0 6px 4px' }}>
      {['/', '-', '_', '|', '~', '*', '&', '<', '>', '$'].map((c) => (
        <TermKey key={c}>{c}</TermKey>
      ))}
    </div>
    <div style={{ display: 'flex', gap: 5, padding: '0 6px 4px' }}>
      {[':', ';', '"', "'", '`', '(', ')', '[', ']', '#'].map((c) => (
        <TermKey key={c}>{c}</TermKey>
      ))}
    </div>

    {/* Letter rows */}
    <div style={{ display: 'flex', gap: 5, padding: '0 6px 4px' }}>
      {'qwertyuiop'.split('').map((c) => (
        <TermKey key={c}>{c}</TermKey>
      ))}
    </div>
    <div style={{ display: 'flex', gap: 5, padding: '0 12px 4px' }}>
      {'asdfghjkl'.split('').map((c) => (
        <TermKey key={c}>{c}</TermKey>
      ))}
    </div>
    <div style={{ display: 'flex', gap: 5, padding: '0 6px 4px' }}>
      <TermKey w={42} small>
        ⇧
      </TermKey>
      {'zxcvbnm'.split('').map((c) => (
        <TermKey key={c}>{c}</TermKey>
      ))}
      <TermKey w={42} small>
        ⌫
      </TermKey>
    </div>

    {/* Bottom bar */}
    <div style={{ display: 'flex', gap: 5, padding: '0 6px 6px' }}>
      <TermKey w={56} small mono={false}>
        123
      </TermKey>
      <TermKey w={36} small>
        <Icon name="sparkles" size={13} color="#7dd3a0" />
      </TermKey>
      <TermKey flex>space</TermKey>
      <TermKey w={36} small>
        .
      </TermKey>
      <TermKey w={70} small accent mono={false}>
        return ⏎
      </TermKey>
    </div>

    {/* Down arrow + dock indicator */}
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '4px 0 2px',
        gap: 18,
        color: '#6e6957',
        fontSize: 11,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Icon name="chevron_down" size={11} /> hide
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>swipe ↑ for symbols</span>
    </div>
  </div>
)

// ─────────────────────────────────────────────
// 4. TERMINAL — main view with custom keyboard
// ─────────────────────────────────────────────
const TermLine = ({ children, prompt, dim }) => (
  <div
    className="mono"
    style={{
      fontSize: 12,
      lineHeight: 1.5,
      color: dim ? '#4a463a' : '#c8c2b0',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
    }}
  >
    {prompt && <span style={{ color: '#7dd3a0' }}>{prompt} </span>}
    {children}
  </div>
)
const A = ({ c, children }) => <span style={{ color: `var(--ansi-${c})` }}>{children}</span>

const MobileTerminal = () => (
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
      <Icon name="chevron_left" size={20} color="#7dd3a0" />
      <Dot state="connected" size={7} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="mono"
          style={{
            fontSize: 13,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          web-01.prod
        </div>
        <div className="mono" style={{ fontSize: 10, color: '#6e6957' }}>
          deploy@10.0.4.21 · 22ms
        </div>
      </div>
      <Icon name="split" size={18} color="#a39d8a" />
      <Icon name="sparkles" size={18} color="#7dd3a0" />
      <Icon name="more" size={18} color="#a39d8a" />
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
      {[
        { name: 'web-01.prod', state: 'connected', active: true },
        { name: 'db-primary', state: 'connected' },
        { name: 'k8s-master', state: 'connecting' },
      ].map((t) => (
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
          <Dot state={t.state} size={5} />
          <span className="mono" style={{ color: t.active ? '#e7e2d4' : '#a39d8a' }}>
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
        <Icon name="plus" size={13} />
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
        <A c="bright-black">[14:22:09]</A> <A c="green">INFO</A> GET /api/v1/users/42 → 200
      </TermLine>
      <TermLine>
        <A c="bright-black">[14:22:11]</A> <A c="yellow">WARN</A> Slow query (412ms)
      </TermLine>
      <TermLine>
        <A c="bright-black">[14:22:14]</A> <A c="red">ERROR</A> Postgres: too many connections
      </TermLine>
      <TermLine />
      <div className="mono" style={{ fontSize: 12, display: 'flex', alignItems: 'center' }}>
        <span style={{ color: '#7dd3a0' }}>deploy@web-01:/srv/app$ </span>
        <span style={{ color: '#c8c2b0' }}>psql -h db</span>
        <span style={{ width: 7, height: 14, background: '#7dd3a0', marginLeft: 1 }} />
      </div>
    </div>
    {/* keyboard pinned to bottom */}
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 8 }}>
      <TerminalKeyboard />
    </div>
  </MobileBg>
)

// ─────────────────────────────────────────────
// 5. TERMINAL with AI suggestion (ghost)
// ─────────────────────────────────────────────
const MobileTerminalAi = () => (
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
      <Icon name="chevron_left" size={20} color="#7dd3a0" />
      <Dot state="connected" size={7} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mono" style={{ fontSize: 13, fontWeight: 500 }}>
          web-01.prod
        </div>
        <div className="mono" style={{ fontSize: 10, color: '#6e6957' }}>
          deploy@10.0.4.21 · AI ready
        </div>
      </div>
      <Icon name="sparkles" size={18} color="#7dd3a0" />
      <Icon name="more" size={18} color="#a39d8a" />
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
        <Icon name="sparkles" size={12} color="#7dd3a0" />
        <span style={{ fontSize: 11, fontWeight: 600, color: '#7dd3a0' }}>Trominal AI</span>
        <span style={{ fontSize: 11, color: '#6e6957' }}>· based on your last command</span>
      </div>
      <div style={{ fontSize: 13, color: '#e7e2d4', lineHeight: 1.5 }}>
        Postgres has hit max_connections. Try counting active sessions first:
      </div>
      <div
        className="mono"
        style={{
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
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          <A c="green">SELECT</A> state, <A c="cyan">count</A>(*) FROM pg_stat_activity GROUP BY
          state;
        </span>
        <Icon name="copy" size={13} color="#a39d8a" />
        <Icon name="terminal" size={13} color="#7dd3a0" />
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
        className="mono"
        style={{ fontSize: 12, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}
      >
        <span style={{ color: '#7dd3a0' }}>deploy@web-01:/srv/app$ </span>
        <span style={{ color: '#c8c2b0' }}>psql </span>
        <span style={{ color: '#4a463a', fontStyle: 'italic' }}>-h db.prod.acme -U postgres</span>
        <span style={{ width: 7, height: 14, background: '#7dd3a0', marginLeft: 1 }} />
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
        <Icon name="sparkles" size={11} color="#7dd3a0" />
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
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 8 }}>
      <TerminalKeyboard />
    </div>
  </MobileBg>
)

// ─────────────────────────────────────────────
// 6. SNIPPETS quick-launcher (bottom sheet over hosts)
// ─────────────────────────────────────────────
const MobileSnippets = () => {
  const snippets = [
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
    { name: 'nginx · reload', desc: 'sudo systemctl reload nginx', tag: 'ops', color: '#7dd3a0' },
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
  return (
    <MobileBg>
      <StatusSpacer />
      <MobileHeader
        title="Snippets"
        sub="8 snippets · synced"
        leading={<Logo size={13} />}
        trailing={
          <>
            <Icon name="filter" size={20} color="#7dd3a0" />
            <Icon name="plus" size={22} color="#7dd3a0" />
          </>
        }
        search="Search snippets, tags…"
      />
      <div style={{ padding: '0 16px 100px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {snippets.map((s) => (
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
              <Icon name="code" size={14} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{s.name}</span>
                <Badge tone="outline" mono>
                  {s.tag}
                </Badge>
              </div>
              <div
                className="mono"
                style={{
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
              <Icon name="play" size={12} />
            </div>
          </div>
        ))}
      </div>
      <TabBar active="snippets" />
    </MobileBg>
  )
}

// ─────────────────────────────────────────────
// 7. SFTP file browser
// ─────────────────────────────────────────────
const MobileSFTP = () => {
  const files = [
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
  return (
    <MobileBg>
      <StatusSpacer />
      <MobileHeader
        title="Files"
        sub={null}
        leading={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="chevron_left" size={20} color="#7dd3a0" />
            <span style={{ fontSize: 14, color: '#7dd3a0' }}>web-01.prod</span>
          </div>
        }
        trailing={
          <>
            <Icon name="upload" size={20} color="#7dd3a0" />
            <Icon name="more" size={20} color="#7dd3a0" />
          </>
        }
        large={false}
      />
      <div style={{ padding: '0 16px 16px' }}>
        <div
          className="mono"
          style={{
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
          <Dot state="connected" size={6} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>/srv/app</span>
          <Icon name="refresh" size={13} />
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
          {files.map((f, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                borderBottom: i < files.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none',
              }}
            >
              <Icon name={f.icon} size={18} color={f.icon === 'folder' ? '#7aa2f7' : '#6e6957'} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  className="mono"
                  style={{
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
                  <div className="mono" style={{ fontSize: 11, color: '#6e6957' }}>
                    {f.size} · {f.date}
                  </div>
                )}
              </div>
              {f.badge && <Badge tone="accent">{f.badge}</Badge>}
              <Icon name="chevron_right" size={14} color="#4a463a" />
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
          <Icon name="arrow_up_down" size={14} />
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
        <Icon name="chevron_down" size={16} color="#a39d8a" />
      </div>
      <TabBar active="sftp" />
    </MobileBg>
  )
}

// ─────────────────────────────────────────────
// 8. SETTINGS
// ─────────────────────────────────────────────
const MobileSettings = () => {
  const Group = ({ title, children }) => (
    <div style={{ marginBottom: 18 }}>
      {title && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#a39d8a',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            padding: '0 4px 8px',
          }}
        >
          {title}
        </div>
      )}
      <div
        style={{
          background: '#1c1a14',
          borderRadius: 14,
          border: '0.5px solid rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  )
  const Row = ({ icon, color, label, value, last, toggle, on }) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 14px',
        borderBottom: last ? 'none' : '0.5px solid rgba(255,255,255,0.05)',
      }}
    >
      {icon && (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: (color || '#7dd3a0') + '22',
            color: color || '#7dd3a0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={14} />
        </div>
      )}
      <span style={{ flex: 1, fontSize: 15 }}>{label}</span>
      {value && <span style={{ fontSize: 13, color: '#6e6957' }}>{value}</span>}
      {toggle ? <Toggle on={on} /> : <Icon name="chevron_right" size={14} color="#4a463a" />}
    </div>
  )
  return (
    <MobileBg>
      <StatusSpacer />
      <MobileHeader title="Settings" leading={<Logo size={13} />} />
      <div style={{ padding: '0 16px 100px' }}>
        {/* account card */}
        <div
          style={{
            background: '#1c1a14',
            borderRadius: 14,
            padding: 14,
            border: '0.5px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 11,
              background: '#24211a',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>
              RM
            </span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 500 }}>riley@acme.io</div>
            <div className="mono" style={{ fontSize: 11, color: '#6e6957', marginTop: 2 }}>
              trominal.acme.internal
            </div>
          </div>
          <Badge tone="accent" dot>
            synced
          </Badge>
        </div>

        <Group title="Vault">
          <Row icon="lock" label="Auto-lock" value="15 min" />
          <Row icon="shield" color="#7aa2f7" label="Face ID" toggle on />
          <Row icon="key" color="#e0b870" label="Identities" value="4 keys" />
          <Row icon="power" color="#f17a7a" label="Lock now" last />
        </Group>

        <Group title="AI">
          <Row icon="sparkles" label="Provider" value="Anthropic" />
          <Row icon="bolt" color="#e0b870" label="Inline ghost text" toggle on />
          <Row icon="terminal" color="#7aa2f7" label="Send terminal context" toggle />
          <Row icon="more" label="Model" value="claude-sonnet-4.5" last />
        </Group>

        <Group title="Appearance">
          <Row icon="monitor" label="Theme" value="Dark" color="#c897e0" />
          <Row icon="code" color="#7aa2f7" label="Terminal font" value="JetBrains Mono" />
          <Row icon="filter" color="#e0b870" label="Color scheme" value="Trominal" last />
        </Group>

        <Group title="Connection">
          <Row icon="server" label="Server" value="acme.internal" />
          <Row icon="refresh" color="#7aa2f7" label="Sync" value="2m ago" />
          <Row icon="power" color="#f17a7a" label="Sign out" last />
        </Group>
      </div>
      <TabBar active="settings" />
    </MobileBg>
  )
}

// ─────────────────────────────────────────────
// 9. CONNECT (onboarding)
// ─────────────────────────────────────────────
const MobileConnect = () => (
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
        <Logo size={16} />
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
          <div style={{ fontSize: 12, color: '#a39d8a', marginBottom: 6, fontWeight: 500 }}>
            Server URL
          </div>
          <div
            className="mono"
            style={{
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
            <Icon name="server" size={16} color="#a39d8a" />
            <span style={{ flex: 1 }}>https://trominal.acme.internal</span>
            <Icon name="x" size={14} color="#6e6957" />
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
          <Icon name="check" size={15} color="#7dd3a0" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Reachable · v1.4.2</div>
            <div className="mono" style={{ fontSize: 11, color: '#a39d8a', marginTop: 2 }}>
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
          <Icon name="bolt" size={15} color="#7dd3a0" /> Use Trominal Cloud (beta)
        </button>
      </div>
    </div>
  </MobileBg>
)

// ─────────────────────────────────────────────
// 10. TUNNELS
// ─────────────────────────────────────────────
const MobileTunnels = () => {
  const tunnels = [
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
  const tone = { L: 'info', R: 'warning', D: 'accent' }
  return (
    <MobileBg>
      <StatusSpacer />
      <MobileHeader
        title="Tunnels"
        sub="3 active · 1 stopped"
        leading={<Icon name="chevron_left" size={20} color="#7dd3a0" />}
        trailing={<Icon name="plus" size={22} color="#7dd3a0" />}
      />
      <div style={{ padding: '0 16px 60px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tunnels.map((t, i) => (
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
              <Badge tone={tone[t.kind]} mono>
                {t.kind}
              </Badge>
              <span className="mono" style={{ fontSize: 14, fontWeight: 500 }}>
                :{t.local}
              </span>
              <Icon name="arrow_right" size={14} color="#6e6957" />
              <span
                className="mono"
                style={{
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
              <Icon name="server" size={11} />
              <span className="mono">via {t.host}</span>
              <span>·</span>
              <span className="mono" style={{ color: t.on ? '#7dd3a0' : '#6e6957' }}>
                {t.traffic}
              </span>
              <div style={{ flex: 1 }} />
              <Dot state={t.on ? 'connected' : 'idle'} size={6} />
            </div>
          </div>
        ))}
      </div>
    </MobileBg>
  )
}

Object.assign(window, {
  MobileUnlock,
  MobileHosts,
  MobileHostSheet,
  MobileTerminal,
  MobileTerminalAi,
  MobileSnippets,
  MobileSFTP,
  MobileSettings,
  MobileConnect,
  MobileTunnels,
  TerminalKeyboard,
  Phone,
})
