import { describe, expect, it } from 'vitest'
import {
  MAX_TERMINAL_FONT_SIZE,
  MIN_TERMINAL_FONT_SIZE,
  clampTerminalFontSize,
  terminalThemeFor,
} from './appearance'

describe('appearance preferences', () => {
  it('clamps terminal font size to supported bounds', () => {
    expect(clampTerminalFontSize(2)).toBe(MIN_TERMINAL_FONT_SIZE)
    expect(clampTerminalFontSize(99)).toBe(MAX_TERMINAL_FONT_SIZE)
    expect(clampTerminalFontSize(14.4)).toBe(14)
    expect(clampTerminalFontSize(Number.NaN)).toBe(13)
  })

  it('returns the requested terminal palette', () => {
    expect(terminalThemeFor('high-contrast').background).toBe('#050505')
    expect(terminalThemeFor('solarized-dark').cursor).toBe('#2aa198')
  })
})
