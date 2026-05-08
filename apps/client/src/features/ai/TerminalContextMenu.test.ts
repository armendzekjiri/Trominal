import { describe, expect, it } from 'vitest'
import type { Terminal } from '@xterm/xterm'
import { lastCommandLine } from './TerminalContextMenu'

function fakeTerminal(lines: ReadonlyArray<string>): Terminal {
  return {
    buffer: {
      active: {
        length: lines.length,
        getLine(row: number) {
          if (row < 0 || row >= lines.length) return undefined
          return {
            translateToString() {
              return lines[row] ?? ''
            },
          }
        },
      },
    },
  } as unknown as Terminal
}

describe('lastCommandLine fallback', () => {
  it('returns the last non-blank line near the cursor', () => {
    const terminal = fakeTerminal(['old prompt', '', 'last command', '  '])
    expect(lastCommandLine(terminal)).toBe('last command')
  })

  it('returns an empty string when the trailing rows are blank', () => {
    const terminal = fakeTerminal(['', '', '', '', ''])
    expect(lastCommandLine(terminal)).toBe('')
  })

  it('only scans the last few rows so very old text is ignored', () => {
    const lines = Array.from({ length: 30 }, (_, i) => (i < 25 ? `line-${i}` : ''))
    expect(lastCommandLine(fakeTerminal(lines))).toBe('')
  })
})
