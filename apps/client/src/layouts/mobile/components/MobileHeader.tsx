import type { ReactNode } from 'react'
import { MobileIcon } from './MobileIcon'

export function MobileHeader({
  title,
  sub,
  leading,
  trailing,
  search,
  large = true,
}: {
  title: string
  sub?: string | null
  leading?: ReactNode
  trailing?: ReactNode
  search?: string
  large?: boolean
}) {
  return (
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>{trailing}</div>
      </div>
      {large && (
        <div style={{ padding: '4px 20px 12px' }}>
          <h1
            style={{
              margin: 0,
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
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
            <MobileIcon name="search" size={15} />
            <span style={{ flex: 1 }}>{search}</span>
          </div>
        </div>
      )}
    </div>
  )
}
