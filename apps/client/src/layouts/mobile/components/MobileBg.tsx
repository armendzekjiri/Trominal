import type { CSSProperties, ReactNode } from 'react'

/**
 * Mobile screen background. `position: relative` so absolute children
 * (tab bar, sheets, keyboard) anchor to it.
 */
export function MobileBg({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
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
}

/** Spacer below the dynamic island. */
export function StatusSpacer() {
  return <div style={{ height: 60 }} />
}
