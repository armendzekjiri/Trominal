import type { ReactNode } from 'react'

const ANSI: Record<string, string> = {
  black: '#14130f',
  red: '#f17a7a',
  green: '#7dd3a0',
  yellow: '#e0b870',
  blue: '#7aa2f7',
  magenta: '#c897e0',
  cyan: '#7dd3c0',
  white: '#c8c2b0',
  'bright-black': '#4a463a',
  'bright-red': '#ff8f8f',
  'bright-green': '#92dfb1',
  'bright-yellow': '#ecc78a',
  'bright-blue': '#93b4f8',
  'bright-magenta': '#d3aae6',
  'bright-cyan': '#92dccc',
  'bright-white': '#e7e2d4',
}

/** Inline ANSI-colored span. `<A c="green">cd</A>` */
export function A({ c, children }: { c: keyof typeof ANSI | string; children: ReactNode }) {
  return <span style={{ color: ANSI[c] ?? '#c8c2b0' }}>{children}</span>
}

/** A single line of terminal output. */
export function TermLine({
  children,
  prompt,
  dim,
}: {
  children?: ReactNode
  prompt?: string
  dim?: boolean
}) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono)',
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
}
