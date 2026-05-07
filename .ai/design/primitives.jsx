/* Trominal primitives — buttons, inputs, badges, sidebar bits, dialogs */

const trPrim = {
  // ---------- Icons (lucide-ish, 1.5px) ----------
  Icon: ({ name, size = 14, color = 'currentColor', style }) => {
    const paths = {
      terminal: (
        <>
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </>
      ),
      server: (
        <>
          <rect x="2" y="3" width="20" height="8" rx="1.5" />
          <rect x="2" y="13" width="20" height="8" rx="1.5" />
          <line x1="6" y1="7" x2="6.01" y2="7" />
          <line x1="6" y1="17" x2="6.01" y2="17" />
        </>
      ),
      key: (
        <>
          <circle cx="8" cy="15" r="4" />
          <path d="M10.85 12.15 19 4" />
          <path d="m18 5 3 3" />
          <path d="m15 8 3 3" />
        </>
      ),
      lock: (
        <>
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </>
      ),
      unlock: (
        <>
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 9.9-1" />
        </>
      ),
      search: (
        <>
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </>
      ),
      plus: (
        <>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </>
      ),
      x: (
        <>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </>
      ),
      check: <polyline points="20 6 9 17 4 12" />,
      eye: (
        <>
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ),
      eye_off: (
        <>
          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </>
      ),
      copy: (
        <>
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </>
      ),
      chevron_down: <polyline points="6 9 12 15 18 9" />,
      chevron_right: <polyline points="9 6 15 12 9 18" />,
      chevron_left: <polyline points="15 6 9 12 15 18" />,
      folder: (
        <path d="M4 4h6l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      ),
      file: (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </>
      ),
      settings: (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </>
      ),
      bolt: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
      tunnel: (
        <>
          <path d="M2 20h20" />
          <path d="M4 20V12a8 8 0 0 1 16 0v8" />
          <path d="M9 20v-6a3 3 0 0 1 6 0v6" />
        </>
      ),
      code: (
        <>
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </>
      ),
      sparkles: (
        <>
          <path d="M12 3 14 9 20 11 14 13 12 19 10 13 4 11 10 9 Z" />
          <path d="M19 3v4" />
          <path d="M21 5h-4" />
        </>
      ),
      circle: <circle cx="12" cy="12" r="9" />,
      dot: <circle cx="12" cy="12" r="4" fill="currentColor" />,
      filter: <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />,
      tag: (
        <>
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </>
      ),
      arrow_right: (
        <>
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </>
      ),
      arrow_up_down: (
        <>
          <path d="m21 16-4 4-4-4" />
          <path d="M17 20V4" />
          <path d="m3 8 4-4 4 4" />
          <path d="M7 4v16" />
        </>
      ),
      upload: (
        <>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </>
      ),
      download: (
        <>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </>
      ),
      split: (
        <>
          <line x1="12" y1="3" x2="12" y2="21" />
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </>
      ),
      more: (
        <>
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
          <circle cx="5" cy="12" r="1" />
        </>
      ),
      kbd: (
        <>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M6 8h.01" />
          <path d="M10 8h.01" />
          <path d="M14 8h.01" />
          <path d="M18 8h.01" />
          <path d="M8 12h.01" />
          <path d="M12 12h.01" />
          <path d="M16 12h.01" />
          <path d="M7 16h10" />
        </>
      ),
      shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
      power: (
        <>
          <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
          <line x1="12" y1="2" x2="12" y2="12" />
        </>
      ),
      mail: (
        <>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <polyline points="22 7 12 13 2 7" />
        </>
      ),
      user: (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </>
      ),
      monitor: (
        <>
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </>
      ),
      refresh: (
        <>
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
          <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
        </>
      ),
      trash: (
        <>
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </>
      ),
      play: <polygon points="6 4 20 12 6 20 6 4" />,
      square: <rect x="5" y="5" width="14" height="14" rx="1" />,
      home: (
        <>
          <path d="M3 12 12 3l9 9" />
          <path d="M5 10v10h14V10" />
        </>
      ),
    }
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0, ...style }}
      >
        {paths[name] || <circle cx="12" cy="12" r="8" />}
      </svg>
    )
  },
}

// ---------- Buttons ----------
trPrim.Button = ({
  variant = 'default',
  size = 'md',
  children,
  icon,
  iconRight,
  full,
  style,
  onClick,
  disabled,
  kbd,
}) => {
  const sizes = {
    sm: { h: 24, px: 8, fs: 12, gap: 6 },
    md: { h: 30, px: 12, fs: 13, gap: 8 },
    lg: { h: 36, px: 16, fs: 14, gap: 10 },
  }[size]
  const variants = {
    default: { bg: 'var(--surface-2)', fg: 'var(--fg)', border: 'var(--border-strong)' },
    primary: { bg: 'var(--accent)', fg: 'var(--accent-fg)', border: 'var(--accent)' },
    ghost: { bg: 'transparent', fg: 'var(--fg)', border: 'transparent' },
    outline: { bg: 'transparent', fg: 'var(--fg)', border: 'var(--border-strong)' },
    danger: { bg: 'var(--danger-soft)', fg: 'var(--danger)', border: 'var(--danger)' },
    subtle: { bg: 'var(--surface)', fg: 'var(--fg-muted)', border: 'var(--border)' },
  }[variant]
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: sizes.gap,
        height: sizes.h,
        padding: `0 ${sizes.px}px`,
        width: full ? '100%' : undefined,
        fontFamily: 'var(--font-ui)',
        fontSize: sizes.fs,
        fontWeight: 500,
        background: variants.bg,
        color: variants.fg,
        border: `1px solid ${variants.border}`,
        borderRadius: 'var(--r-3)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
        justifyContent: full ? 'center' : undefined,
        ...style,
      }}
    >
      {icon && <trPrim.Icon name={icon} size={sizes.fs + 1} />}
      {children}
      {iconRight && <trPrim.Icon name={iconRight} size={sizes.fs + 1} />}
      {kbd && (
        <span
          className="mono"
          style={{
            marginLeft: 4,
            padding: '1px 5px',
            borderRadius: 3,
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid var(--border)',
            fontSize: 11,
            color: 'var(--fg-muted)',
          }}
        >
          {kbd}
        </span>
      )}
    </button>
  )
}

// ---------- Inputs ----------
trPrim.Input = ({
  value,
  placeholder,
  icon,
  suffix,
  mono,
  type = 'text',
  style,
  label,
  hint,
  error,
  fullWidth = true,
}) => (
  <label style={{ display: 'block', width: fullWidth ? '100%' : undefined }}>
    {label && (
      <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 6, fontWeight: 500 }}>
        {label}
      </div>
    )}
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 32,
        padding: '0 10px',
        background: 'var(--surface)',
        border: `1px solid ${error ? 'var(--danger)' : 'var(--border-strong)'}`,
        borderRadius: 'var(--r-3)',
        color: 'var(--fg)',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-ui)',
        fontSize: 13,
        ...style,
      }}
    >
      {icon && <trPrim.Icon name={icon} size={14} color="var(--fg-faint)" />}
      <span
        style={{
          flex: 1,
          color: value ? 'var(--fg)' : 'var(--fg-faint)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value || placeholder}
      </span>
      {suffix}
    </div>
    {hint && (
      <div
        style={{ fontSize: 11, color: error ? 'var(--danger)' : 'var(--fg-faint)', marginTop: 4 }}
      >
        {hint}
      </div>
    )}
  </label>
)

trPrim.Field = ({ label, hint, children, span }) => (
  <div style={{ gridColumn: span ? `span ${span}` : undefined }}>
    {label && (
      <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 6, fontWeight: 500 }}>
        {label}
      </div>
    )}
    {children}
    {hint && <div style={{ fontSize: 11, color: 'var(--fg-faint)', marginTop: 4 }}>{hint}</div>}
  </div>
)

// ---------- Badge ----------
trPrim.Badge = ({ children, tone = 'neutral', dot, mono, style }) => {
  const tones = {
    neutral: { bg: 'var(--surface-2)', fg: 'var(--fg-muted)', bd: 'var(--border)' },
    accent: { bg: 'var(--accent-soft)', fg: 'var(--accent)', bd: 'var(--accent-soft)' },
    danger: { bg: 'var(--danger-soft)', fg: 'var(--danger)', bd: 'var(--danger-soft)' },
    warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)', bd: 'var(--warning-soft)' },
    info: { bg: 'var(--info-soft)', fg: 'var(--info)', bd: 'var(--info-soft)' },
    outline: { bg: 'transparent', fg: 'var(--fg-muted)', bd: 'var(--border-strong)' },
  }[tone]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 7px',
        height: 20,
        borderRadius: 'var(--r-3)',
        fontSize: 11,
        fontWeight: 500,
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-ui)',
        background: tones.bg,
        color: tones.fg,
        border: `1px solid ${tones.bd}`,
        ...style,
      }}
    >
      {dot && (
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
      )}
      {children}
    </span>
  )
}

// ---------- Status dot ----------
trPrim.Dot = ({ state = 'idle', size = 8 }) => {
  const colors = {
    connected: 'var(--accent)',
    connecting: 'var(--warning)',
    error: 'var(--danger)',
    idle: 'var(--fg-dim)',
  }
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: colors[state],
        boxShadow:
          state === 'connected'
            ? '0 0 0 3px rgba(125,211,160,0.15)'
            : state === 'connecting'
              ? '0 0 0 3px rgba(224,184,112,0.15)'
              : state === 'error'
                ? '0 0 0 3px rgba(241,122,122,0.15)'
                : 'none',
        flexShrink: 0,
      }}
    />
  )
}

// ---------- Kbd ----------
trPrim.Kbd = ({ children, style }) => (
  <span
    className="mono"
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 18,
      height: 18,
      padding: '0 4px',
      background: 'var(--surface-2)',
      border: '1px solid var(--border-strong)',
      borderRadius: 'var(--r-1)',
      fontSize: 11,
      color: 'var(--fg-muted)',
      ...style,
    }}
  >
    {children}
  </span>
)

// ---------- Sidebar item ----------
trPrim.SideItem = ({ icon, label, active, badge, onClick, indent = 0, color }) => (
  <div
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: `6px ${10}px 6px ${10 + indent}px`,
      height: 28,
      background: active ? 'var(--surface-3)' : 'transparent',
      borderRadius: 'var(--r-3)',
      color: active ? 'var(--fg)' : 'var(--fg-muted)',
      fontSize: 13,
      cursor: 'pointer',
      userSelect: 'none',
      borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
      paddingLeft: 10 + indent - 2,
    }}
  >
    {color !== undefined && (
      <span
        style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }}
      />
    )}
    {icon && <trPrim.Icon name={icon} size={14} />}
    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {label}
    </span>
    {badge !== undefined && <span style={{ fontSize: 11, color: 'var(--fg-faint)' }}>{badge}</span>}
  </div>
)

// ---------- Card ----------
trPrim.Card = ({ children, style, padded = true, hover, onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-3)',
      padding: padded ? 14 : 0,
      cursor: hover ? 'pointer' : undefined,
      ...style,
    }}
  >
    {children}
  </div>
)

// ---------- Window chrome (faux app frame) ----------
trPrim.AppFrame = ({ children, title = 'trominal', actions, style }) => (
  <div
    style={{
      background: 'var(--bg)',
      color: 'var(--fg)',
      borderRadius: 'var(--r-4)',
      overflow: 'hidden',
      border: '1px solid var(--border-strong)',
      boxShadow: 'var(--sh-3)',
      fontFamily: 'var(--font-ui)',
      fontSize: 13,
      display: 'flex',
      flexDirection: 'column',
      ...style,
    }}
  >
    <div
      style={{
        height: 32,
        background: 'var(--bg-elev)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', gap: 6 }}>
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#3a352d' }} />
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#3a352d' }} />
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#3a352d' }} />
      </div>
      <div
        className="mono"
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 11,
          color: 'var(--fg-faint)',
        }}
      >
        {title}
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        {actions}
      </div>
    </div>
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {children}
    </div>
  </div>
)

// ---------- Logo ----------
trPrim.Logo = ({ size = 14, color = 'var(--accent)' }) => (
  <div
    className="mono"
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: size,
      fontWeight: 600,
      color: 'var(--fg)',
      letterSpacing: '-0.01em',
    }}
  >
    <span style={{ color }}>{'>'}</span>
    <span>trominal</span>
  </div>
)

// ---------- Toggle ----------
trPrim.Toggle = ({ on, label, onChange }) => (
  <div
    onClick={() => onChange && onChange(!on)}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      cursor: 'pointer',
    }}
  >
    <div
      style={{
        width: 28,
        height: 16,
        borderRadius: 999,
        background: on ? 'var(--accent)' : 'var(--surface-3)',
        border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border-strong)'),
        position: 'relative',
        transition: 'background 120ms',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 1,
          left: on ? 13 : 1,
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: on ? 'var(--accent-fg)' : 'var(--fg-muted)',
          transition: 'left 120ms',
        }}
      />
    </div>
    {label && <span style={{ fontSize: 13 }}>{label}</span>}
  </div>
)

// ---------- Section header ----------
trPrim.SectionLabel = ({ children, action, style }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 10px 6px',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.06em',
      color: 'var(--fg-faint)',
      textTransform: 'uppercase',
      ...style,
    }}
  >
    <span>{children}</span>
    {action}
  </div>
)

// Export
Object.assign(window, { trPrim })
