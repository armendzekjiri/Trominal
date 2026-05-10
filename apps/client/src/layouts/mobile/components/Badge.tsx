import type { ReactNode } from 'react'

type Tone = 'accent' | 'info' | 'warning' | 'danger' | 'outline'

const toneStyles: Record<Tone, { bg: string; fg: string; border: string }> = {
  accent: { bg: 'rgba(125,211,160,0.14)', fg: '#7dd3a0', border: 'rgba(125,211,160,0.35)' },
  info: { bg: 'rgba(122,162,247,0.14)', fg: '#7aa2f7', border: 'rgba(122,162,247,0.35)' },
  warning: { bg: 'rgba(224,184,112,0.14)', fg: '#e0b870', border: 'rgba(224,184,112,0.35)' },
  danger: { bg: 'rgba(241,122,122,0.14)', fg: '#f17a7a', border: 'rgba(241,122,122,0.35)' },
  outline: { bg: 'transparent', fg: '#a39d8a', border: 'rgba(255,255,255,0.12)' },
}

export function Badge({
  children,
  tone = 'outline',
  mono = false,
  dot = false,
}: {
  children: ReactNode
  tone?: Tone
  mono?: boolean
  dot?: boolean
}) {
  const t = toneStyles[tone]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        borderRadius: 6,
        background: t.bg,
        color: t.fg,
        border: `0.5px solid ${t.border}`,
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: mono ? 0.2 : 0,
        whiteSpace: 'nowrap',
      }}
    >
      {dot && (
        <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: t.fg }} />
      )}
      {children}
    </span>
  )
}
