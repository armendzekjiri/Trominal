/** True when running inside a Tauri desktop window, false in any browser. */
export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** Coarse runtime label for picking platform-specific implementations. */
export const platform: 'desktop' | 'web' = isTauri ? 'desktop' : 'web'
