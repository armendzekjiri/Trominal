import type { ReactNode } from 'react'
import { MobileIcon } from './MobileIcon'

/**
 * The custom mobile terminal keyboard — Trominal's hero feature.
 *
 * Purpose-built for SSH so users never dig through three iOS keyboard layers
 * to type `|` or `~`. Includes:
 *   - Snippet quick-bar (ls -la, git status, ↑ history, Ask AI)
 *   - Modifier row (esc, tab, ctrl, alt, ⌘, ^C, ^D) + arrow cluster
 *   - Two terminal-tuned symbol rows
 *   - QWERTY rows
 *   - Bottom row with 123 / sparkles AI / space / . / return
 */

type TermKeyProps = {
  children: ReactNode
  flex?: number
  w?: number
  h?: number
  accent?: boolean
  sub?: string
  dim?: boolean
  small?: boolean
  mono?: boolean
}

function TermKey({
  children,
  flex = 1,
  w,
  h = 40,
  accent,
  sub,
  dim,
  small,
  mono = true,
}: TermKeyProps) {
  return (
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
        userSelect: 'none',
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
}

const SNIPPETS: ReadonlyArray<{ label: string; accent?: boolean; icon?: 'sparkles' }> = [
  { label: 'ls -la' },
  { label: 'git status' },
  { label: 'tail -f' },
  { label: '↑ history', accent: true },
  { label: 'Ask AI', icon: 'sparkles', accent: true },
]

const SYMBOLS_TOP = ['/', '-', '_', '|', '~', '*', '&', '<', '>', '$']
const SYMBOLS_BOTTOM = [':', ';', '"', "'", '`', '(', ')', '[', ']', '#']
const ROW_QWE = 'qwertyuiop'.split('')
const ROW_ASD = 'asdfghjkl'.split('')
const ROW_ZXC = 'zxcvbnm'.split('')

export function TerminalKeyboard() {
  return (
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
        {SNIPPETS.map((s) => (
          <div
            key={s.label}
            style={{
              padding: '6px 10px',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'var(--font-mono)',
              background: s.accent ? 'rgba(125,211,160,0.14)' : 'rgba(255,255,255,0.06)',
              color: s.accent ? '#7dd3a0' : '#e7e2d4',
              border: `0.5px solid ${
                s.accent ? 'rgba(125,211,160,0.35)' : 'rgba(255,255,255,0.08)'
              }`,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              whiteSpace: 'nowrap',
            }}
          >
            {s.icon && <MobileIcon name={s.icon} size={11} />}
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
          <MobileIcon name="chevron_left" size={13} />
        </TermKey>
        <TermKey small w={32} sub="↑">
          <span style={{ fontSize: 13 }}>▲</span>
        </TermKey>
        <TermKey small w={32}>
          <MobileIcon name="chevron_right" size={13} />
        </TermKey>
      </div>

      {/* Symbol rows */}
      <div style={{ display: 'flex', gap: 5, padding: '0 6px 4px' }}>
        {SYMBOLS_TOP.map((c) => (
          <TermKey key={c}>{c}</TermKey>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 5, padding: '0 6px 4px' }}>
        {SYMBOLS_BOTTOM.map((c) => (
          <TermKey key={c}>{c}</TermKey>
        ))}
      </div>

      {/* Letter rows */}
      <div style={{ display: 'flex', gap: 5, padding: '0 6px 4px' }}>
        {ROW_QWE.map((c) => (
          <TermKey key={c}>{c}</TermKey>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 5, padding: '0 12px 4px' }}>
        {ROW_ASD.map((c) => (
          <TermKey key={c}>{c}</TermKey>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 5, padding: '0 6px 4px' }}>
        <TermKey w={42} small>
          ⇧
        </TermKey>
        {ROW_ZXC.map((c) => (
          <TermKey key={c}>{c}</TermKey>
        ))}
        <TermKey w={42} small>
          ⌫
        </TermKey>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'flex', gap: 5, padding: '0 6px 6px' }}>
        <TermKey w={56} small mono={false}>
          123
        </TermKey>
        <TermKey w={36} small>
          <MobileIcon name="sparkles" size={13} color="#7dd3a0" />
        </TermKey>
        <TermKey>space</TermKey>
        <TermKey w={36} small>
          .
        </TermKey>
        <TermKey w={70} small accent mono={false}>
          return ⏎
        </TermKey>
      </div>

      {/* Footer hint row */}
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
          <MobileIcon name="chevron_down" size={11} /> hide
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>swipe ↑ for symbols</span>
      </div>
    </div>
  )
}
