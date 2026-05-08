import { create } from 'zustand'
import { useEffect } from 'react'

export type AppTheme = 'dark' | 'light' | 'system'
export type TerminalPaletteId = 'trominal' | 'high-contrast' | 'solarized-dark'

export type TerminalTheme = {
  background: string
  foreground: string
  cursor: string
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
}

type AppearanceSnapshot = {
  appTheme: AppTheme
  terminalFontSize: number
  terminalPalette: TerminalPaletteId
}

type AppearanceActions = {
  setAppTheme: (theme: AppTheme) => void
  setTerminalFontSize: (fontSize: number) => void
  setTerminalPalette: (palette: TerminalPaletteId) => void
  resetAppearance: () => void
}

export type AppearanceStore = AppearanceSnapshot & AppearanceActions

export const MIN_TERMINAL_FONT_SIZE = 11
export const MAX_TERMINAL_FONT_SIZE = 18

const STORAGE_KEY = 'trominal:appearance'

const DEFAULT_APPEARANCE: AppearanceSnapshot = {
  appTheme: 'dark',
  terminalFontSize: 13,
  terminalPalette: 'trominal',
}

export const APP_THEME_OPTIONS: ReadonlyArray<{
  id: AppTheme
  label: string
  description: string
}> = [
  { id: 'dark', label: 'Dark', description: 'Warm charcoal default.' },
  { id: 'light', label: 'Light', description: 'Bright operator UI.' },
  { id: 'system', label: 'System', description: 'Follow OS preference.' },
]

export const TERMINAL_PALETTES: ReadonlyArray<{
  id: TerminalPaletteId
  label: string
  description: string
  theme: TerminalTheme
}> = [
  {
    id: 'trominal',
    label: 'Trominal',
    description: 'Warm dark palette tuned for long SSH sessions.',
    theme: {
      background: '#14130f',
      foreground: '#c8c2b0',
      cursor: '#7dd3a0',
      black: '#14130f',
      red: '#f17a7a',
      green: '#7dd3a0',
      yellow: '#e0b870',
      blue: '#7aa2f7',
      magenta: '#c897e0',
      cyan: '#7dd3c0',
      white: '#c8c2b0',
      brightBlack: '#4a463a',
      brightRed: '#ff8f8f',
      brightGreen: '#92dfb1',
      brightYellow: '#ecc78a',
      brightBlue: '#93b4f8',
      brightMagenta: '#d3aae6',
      brightCyan: '#92dccc',
      brightWhite: '#e7e2d4',
    },
  },
  {
    id: 'high-contrast',
    label: 'High contrast',
    description: 'Sharper contrast for dense terminal output.',
    theme: {
      background: '#050505',
      foreground: '#f2f2f2',
      cursor: '#00ff99',
      black: '#050505',
      red: '#ff5c57',
      green: '#5af78e',
      yellow: '#f3f99d',
      blue: '#57c7ff',
      magenta: '#ff6ac1',
      cyan: '#9aedfe',
      white: '#f2f2f2',
      brightBlack: '#686868',
      brightRed: '#ff9f9a',
      brightGreen: '#9effbd',
      brightYellow: '#ffffc2',
      brightBlue: '#9cdcfe',
      brightMagenta: '#ffb3df',
      brightCyan: '#c7f9ff',
      brightWhite: '#ffffff',
    },
  },
  {
    id: 'solarized-dark',
    label: 'Solarized dark',
    description: 'Muted ANSI colors for lower glare.',
    theme: {
      background: '#002b36',
      foreground: '#93a1a1',
      cursor: '#2aa198',
      black: '#073642',
      red: '#dc322f',
      green: '#859900',
      yellow: '#b58900',
      blue: '#268bd2',
      magenta: '#d33682',
      cyan: '#2aa198',
      white: '#eee8d5',
      brightBlack: '#586e75',
      brightRed: '#cb4b16',
      brightGreen: '#586e75',
      brightYellow: '#657b83',
      brightBlue: '#839496',
      brightMagenta: '#6c71c4',
      brightCyan: '#93a1a1',
      brightWhite: '#fdf6e3',
    },
  },
]

export function clampTerminalFontSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_APPEARANCE.terminalFontSize
  return Math.min(MAX_TERMINAL_FONT_SIZE, Math.max(MIN_TERMINAL_FONT_SIZE, Math.round(value)))
}

export function terminalThemeFor(id: TerminalPaletteId): TerminalTheme {
  return TERMINAL_PALETTES.find((palette) => palette.id === id)?.theme ?? TERMINAL_PALETTES[0].theme
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isAppTheme(value: unknown): value is AppTheme {
  return value === 'dark' || value === 'light' || value === 'system'
}

function isTerminalPaletteId(value: unknown): value is TerminalPaletteId {
  return value === 'trominal' || value === 'high-contrast' || value === 'solarized-dark'
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function readStoredAppearance(): AppearanceSnapshot {
  const local = storage()
  if (local === null) return DEFAULT_APPEARANCE

  try {
    const raw = local.getItem(STORAGE_KEY)
    if (raw === null) return DEFAULT_APPEARANCE
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return DEFAULT_APPEARANCE

    return {
      appTheme: isAppTheme(parsed.appTheme) ? parsed.appTheme : DEFAULT_APPEARANCE.appTheme,
      terminalFontSize:
        typeof parsed.terminalFontSize === 'number'
          ? clampTerminalFontSize(parsed.terminalFontSize)
          : DEFAULT_APPEARANCE.terminalFontSize,
      terminalPalette: isTerminalPaletteId(parsed.terminalPalette)
        ? parsed.terminalPalette
        : DEFAULT_APPEARANCE.terminalPalette,
    }
  } catch {
    return DEFAULT_APPEARANCE
  }
}

function snapshot(state: AppearanceStore): AppearanceSnapshot {
  return {
    appTheme: state.appTheme,
    terminalFontSize: state.terminalFontSize,
    terminalPalette: state.terminalPalette,
  }
}

function persistAppearance(value: AppearanceSnapshot): void {
  const local = storage()
  if (local === null) return
  try {
    local.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Appearance preferences are non-critical. Keep the runtime state even if
    // the browser blocks persistence.
  }
}

export const useAppearance = create<AppearanceStore>((set, get) => ({
  ...readStoredAppearance(),

  setAppTheme(appTheme) {
    set({ appTheme })
    persistAppearance(snapshot(get()))
  },

  setTerminalFontSize(value) {
    set({ terminalFontSize: clampTerminalFontSize(value) })
    persistAppearance(snapshot(get()))
  },

  setTerminalPalette(terminalPalette) {
    set({ terminalPalette })
    persistAppearance(snapshot(get()))
  },

  resetAppearance() {
    set(DEFAULT_APPEARANCE)
    persistAppearance(DEFAULT_APPEARANCE)
  },
}))

export function useAppearanceDocumentEffect(): void {
  const appTheme = useAppearance((state) => state.appTheme)

  useDocumentTheme(appTheme)
}

function useDocumentTheme(appTheme: AppTheme): void {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: light)')

    const apply = (): void => {
      const resolved = appTheme === 'system' ? (media.matches ? 'light' : 'dark') : appTheme
      if (resolved === 'light') {
        root.dataset.theme = 'light'
      } else {
        delete root.dataset.theme
      }
    }

    apply()

    if (appTheme !== 'system') return undefined
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [appTheme])
}
