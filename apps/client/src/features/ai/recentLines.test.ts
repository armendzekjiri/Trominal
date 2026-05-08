import { describe, expect, it } from 'vitest'
import type { Terminal } from '@xterm/xterm'
import { readRecentLines } from './recentLines'

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

describe('readRecentLines', () => {
  it('returns at most `count` trailing lines', () => {
    const terminal = fakeTerminal(['a', 'b', 'c', 'd', 'e'])
    expect(readRecentLines(terminal, 3)).toEqual(['c', 'd', 'e'])
  })

  it('drops leading blank padding rows', () => {
    const terminal = fakeTerminal(['', '', 'first real', 'second', ''])
    expect(readRecentLines(terminal, 10)).toEqual(['first real', 'second', ''])
  })

  it('returns an empty array when no terminal is mounted', () => {
    expect(readRecentLines(null, 50)).toEqual([])
  })
})
