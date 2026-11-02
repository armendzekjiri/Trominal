import { describe, expect, it } from 'vitest'
import {
  SHORTCUTS,
  formatShortcut,
  isTerminalFocused,
  keyLabels,
  matchesShortcut,
} from './shortcuts'

function key(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent('keydown', init)
}

describe('matchesShortcut', () => {
  it('uses ⌘ on macOS and Ctrl elsewhere', () => {
    expect(matchesShortcut(key({ key: 'k', metaKey: true }), 'palette', true)).toBe(true)
    expect(matchesShortcut(key({ key: 'k', ctrlKey: true }), 'palette', true)).toBe(false)
    expect(matchesShortcut(key({ key: 'k', ctrlKey: true }), 'palette', false)).toBe(true)
    expect(matchesShortcut(key({ key: 'k', metaKey: true }), 'palette', false)).toBe(false)
  })

  it('requires the exact modifiers', () => {
    expect(matchesShortcut(key({ key: 'l', metaKey: true }), 'lock', true)).toBe(false)
    expect(matchesShortcut(key({ key: 'L', metaKey: true, shiftKey: true }), 'lock', true)).toBe(
      true,
    )
    expect(matchesShortcut(key({ key: 'k', metaKey: true, shiftKey: true }), 'palette', true)).toBe(
      false,
    )
    expect(matchesShortcut(key({ key: 'k' }), 'palette', true)).toBe(false)
  })

  it('matches digits and punctuation by physical key', () => {
    expect(
      matchesShortcut(key({ key: '1', code: 'Digit1', metaKey: true }), 'nav.hosts', true),
    ).toBe(true)
    expect(
      matchesShortcut(key({ key: '&', code: 'Digit1', metaKey: true }), 'nav.hosts', true),
    ).toBe(true)
    expect(matchesShortcut(key({ key: '/', code: 'Slash', metaKey: true }), 'help', true)).toBe(
      true,
    )
    expect(
      matchesShortcut(key({ key: ',', code: 'Comma', ctrlKey: true }), 'settings', false),
    ).toBe(true)
  })

  it('matches bracket tab switching by physical key, even with Shift', () => {
    const next = key({ key: '}', code: 'BracketRight', metaKey: true, shiftKey: true })
    expect(matchesShortcut(next, 'terminal.next', true)).toBe(true)
    expect(matchesShortcut(next, 'terminal.prev', true)).toBe(false)
  })

  it('matches Escape without modifiers', () => {
    expect(matchesShortcut(key({ key: 'Escape' }), 'close', true)).toBe(true)
    expect(matchesShortcut(key({ key: 'Escape', metaKey: true }), 'close', true)).toBe(false)
  })
})

describe('labels', () => {
  it('renders platform-specific key names', () => {
    expect(keyLabels(['mod', 'shift', 'l'], true)).toEqual(['⌘', '⇧', 'L'])
    expect(keyLabels(['mod', 'shift', 'l'], false)).toEqual(['Ctrl', 'Shift', 'L'])
    expect(formatShortcut('palette', true)).toBe('⌘K')
    expect(formatShortcut('palette', false)).toBe('Ctrl+K')
  })

  it('has no duplicate bindings', () => {
    const bindings = SHORTCUTS.map((item) => item.keys.join('+'))
    expect(new Set(bindings).size).toBe(bindings.length)
  })
})

describe('isTerminalFocused', () => {
  it('detects elements inside xterm', () => {
    const term = document.createElement('div')
    term.className = 'xterm'
    const textarea = document.createElement('textarea')
    term.appendChild(textarea)
    expect(isTerminalFocused(textarea)).toBe(true)
    expect(isTerminalFocused(document.body)).toBe(false)
    expect(isTerminalFocused(null)).toBe(false)
  })
})
