import type { Terminal } from '@xterm/xterm'

/**
 * Read up to `count` trailing lines out of an xterm scrollback buffer and
 * return them as plain text (stripped of cursor positioning, but retaining
 * visible characters). Used by the Ask AI panel when the user opted in to
 * "send terminal output as context".
 */
export function readRecentLines(terminal: Terminal | null, count: number): string[] {
  if (terminal === null) return []
  const buffer = terminal.buffer.active
  const total = buffer.length
  const start = Math.max(0, total - count)
  const lines: string[] = []
  for (let row = start; row < total; row += 1) {
    const line = buffer.getLine(row)
    if (line === undefined) continue
    // `translateToString(true)` trims trailing spaces, which keeps the
    // captured context shorter without losing any meaningful output.
    lines.push(line.translateToString(true))
  }
  // Drop leading blank lines that just pad the buffer.
  while (lines.length > 0 && lines[0]?.trim() === '') {
    lines.shift()
  }
  return lines
}
