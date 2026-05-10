import type { ReactNode } from 'react'
import { isTauri } from '@/lib/platform'

const PHONE_W = 402
const PHONE_H = 874

/**
 * iPhone bezel for browser preview (`?mobile=1`). On a real phone or inside
 * Tauri mobile we render the children full-bleed since the device is the bezel.
 */
export function Phone({ children }: { children: ReactNode }) {
  const inDevice = isTauri || !matchMedia('(min-width: 600px)').matches
  if (inDevice) return <div className="h-full w-full">{children}</div>

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#08070a] py-8">
      <div
        className="relative overflow-hidden bg-black"
        style={{
          width: PHONE_W,
          height: PHONE_H,
          borderRadius: 48,
          boxShadow: '0 40px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.12)',
        }}
      >
        {/* Dynamic island */}
        <div
          aria-hidden
          className="absolute z-50 bg-black"
          style={{
            top: 11,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 126,
            height: 37,
            borderRadius: 24,
          }}
        />
        {/* Status bar */}
        <div className="absolute inset-x-0 top-0 z-10">
          <StatusBar />
        </div>
        <div className="h-full w-full">{children}</div>
        {/* Home indicator */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[60] flex items-end justify-center pb-2"
          style={{ height: 34 }}
        >
          <div
            style={{
              width: 139,
              height: 5,
              borderRadius: 100,
              background: 'rgba(255,255,255,0.7)',
            }}
          />
        </div>
      </div>
    </div>
  )
}

function StatusBar() {
  return (
    <div
      className="relative z-20 flex w-full items-center justify-center"
      style={{ padding: '21px 24px 19px', gap: 154 }}
    >
      <div className="flex h-[22px] flex-1 items-center justify-center" style={{ paddingTop: 1.5 }}>
        <span
          style={{
            fontFamily: '-apple-system, "SF Pro", system-ui',
            fontWeight: 590,
            fontSize: 17,
            lineHeight: '22px',
            color: '#fff',
          }}
        >
          9:41
        </span>
      </div>
      <div className="flex h-[22px] flex-1 items-center justify-center" style={{ gap: 7 }}>
        {/* Signal */}
        <svg width="19" height="12" viewBox="0 0 19 12">
          <rect x="0" y="7.5" width="3.2" height="4.5" rx="0.7" fill="#fff" />
          <rect x="4.8" y="5" width="3.2" height="7" rx="0.7" fill="#fff" />
          <rect x="9.6" y="2.5" width="3.2" height="9.5" rx="0.7" fill="#fff" />
          <rect x="14.4" y="0" width="3.2" height="12" rx="0.7" fill="#fff" />
        </svg>
        {/* Wi-Fi */}
        <svg width="17" height="12" viewBox="0 0 17 12">
          <path
            d="M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z"
            fill="#fff"
          />
          <path
            d="M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z"
            fill="#fff"
          />
          <circle cx="8.5" cy="10.5" r="1.5" fill="#fff" />
        </svg>
        {/* Battery */}
        <svg width="27" height="13" viewBox="0 0 27 13">
          <rect
            x="0.5"
            y="0.5"
            width="23"
            height="12"
            rx="3.5"
            stroke="#fff"
            strokeOpacity="0.35"
            fill="none"
          />
          <rect x="2" y="2" width="20" height="9" rx="2" fill="#fff" />
          <path
            d="M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z"
            fill="#fff"
            fillOpacity="0.4"
          />
        </svg>
      </div>
    </div>
  )
}
