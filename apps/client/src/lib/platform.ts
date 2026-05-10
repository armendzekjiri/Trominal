/** True when running inside a Tauri shell (desktop or mobile), false in plain browsers. */
export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
const isIOSUA = /iPhone|iPad|iPod/i.test(ua)
const isAndroidUA = /Android/i.test(ua)

/**
 * Browser preview opt-in for the mobile layout: append `?mobile=1` to the dev URL
 * to render the mobile shell from a desktop browser.
 */
const hasMobileQueryFlag =
  typeof window !== 'undefined' && /[?&]mobile=1\b/.test(window.location.search)

/**
 * True for iOS / Android — whether running inside Tauri mobile or just a phone browser —
 * and for the explicit `?mobile=1` flag used when previewing on desktop.
 */
export const isMobile = isIOSUA || isAndroidUA || hasMobileQueryFlag

/** Coarse runtime label used to pick a layout. */
export const platform: 'desktop' | 'mobile' | 'web' = isMobile
  ? 'mobile'
  : isTauri
    ? 'desktop'
    : 'web'
