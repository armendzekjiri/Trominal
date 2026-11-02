/**
 * Single source of truth for app-wide keyboard shortcuts. The global handler, the command
 * palette, tooltips, the ⌘/ cheat sheet and Settings → Shortcuts all read from here, so a
 * binding is never documented in one place and different in another.
 *
 * `mod` is ⌘ on macOS and Ctrl elsewhere.
 */

export const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)

export type ShortcutId =
  | 'palette'
  | 'help'
  | 'settings'
  | 'lock'
  | 'sidebar'
  | 'nav.hosts'
  | 'nav.terminal'
  | 'nav.snippets'
  | 'nav.identities'
  | 'nav.tunnels'
  | 'nav.sftp'
  | 'hosts.search'
  | 'hosts.new'
  | 'terminal.newLocal'
  | 'terminal.next'
  | 'terminal.prev'
  | 'close'

export type Shortcut = {
  id: ShortcutId
  /** Keys in order, e.g. ['mod', 'k']. Single characters are matched case-insensitively. */
  keys: ReadonlyArray<string>
  label: string
  group: 'General' | 'Navigation' | 'Hosts' | 'Terminal'
}

export const SHORTCUTS: ReadonlyArray<Shortcut> = [
  { id: 'palette', keys: ['mod', 'k'], label: 'Open command palette', group: 'General' },
  { id: 'help', keys: ['mod', '/'], label: 'Show keyboard shortcuts', group: 'General' },
  { id: 'settings', keys: ['mod', ','], label: 'Open settings', group: 'General' },
  { id: 'lock', keys: ['mod', 'shift', 'l'], label: 'Lock vault', group: 'General' },
  { id: 'sidebar', keys: ['mod', 'b'], label: 'Toggle sidebar', group: 'General' },
  { id: 'close', keys: ['esc'], label: 'Close dialog or panel', group: 'General' },
  { id: 'nav.hosts', keys: ['mod', '1'], label: 'Go to Hosts', group: 'Navigation' },
  { id: 'nav.terminal', keys: ['mod', '2'], label: 'Go to Terminal', group: 'Navigation' },
  { id: 'nav.snippets', keys: ['mod', '3'], label: 'Go to Snippets', group: 'Navigation' },
  { id: 'nav.identities', keys: ['mod', '4'], label: 'Go to Identities', group: 'Navigation' },
  { id: 'nav.tunnels', keys: ['mod', '5'], label: 'Go to Tunnels', group: 'Navigation' },
  { id: 'nav.sftp', keys: ['mod', '6'], label: 'Go to SFTP', group: 'Navigation' },
  { id: 'hosts.search', keys: ['mod', 'f'], label: 'Search hosts', group: 'Hosts' },
  { id: 'hosts.new', keys: ['mod', 'n'], label: 'New host', group: 'Hosts' },
  { id: 'terminal.newLocal', keys: ['mod', 't'], label: 'New local shell tab', group: 'Terminal' },
  {
    id: 'terminal.next',
    keys: ['mod', 'shift', ']'],
    label: 'Next session tab',
    group: 'Terminal',
  },
  {
    id: 'terminal.prev',
    keys: ['mod', 'shift', '['],
    label: 'Previous session tab',
    group: 'Terminal',
  },
]

export function shortcut(id: ShortcutId): Shortcut {
  const found = SHORTCUTS.find((item) => item.id === id)
  if (found === undefined) throw new Error(`Unknown shortcut: ${id}`)
  return found
}

const MAC_SYMBOLS: Record<string, string> = { mod: '⌘', shift: '⇧', alt: '⌥', esc: 'Esc' }
const PC_NAMES: Record<string, string> = { mod: 'Ctrl', shift: 'Shift', alt: 'Alt', esc: 'Esc' }

/** Display form of each key, e.g. ['⌘', 'K'] on macOS or ['Ctrl', 'K'] elsewhere. */
export function keyLabels(keys: ReadonlyArray<string>, mac = isMac): string[] {
  const names = mac ? MAC_SYMBOLS : PC_NAMES
  return keys.map((key) => names[key] ?? (key.length === 1 ? key.toUpperCase() : key))
}

/** One-string form for tooltips: "⌘K" on macOS, "Ctrl+K" elsewhere. */
export function formatShortcut(id: ShortcutId, mac = isMac): string {
  return keyLabels(shortcut(id).keys, mac).join(mac ? '' : '+')
}

export function matchesShortcut(event: KeyboardEvent, id: ShortcutId, mac = isMac): boolean {
  const keys = shortcut(id).keys
  const wantMod = keys.includes('mod')
  const wantShift = keys.includes('shift')
  const wantAlt = keys.includes('alt')
  const mod = mac ? event.metaKey : event.ctrlKey
  // On macOS a stray Ctrl, and elsewhere a stray Meta, means a different chord.
  const otherMod = mac ? event.ctrlKey : event.metaKey
  if (mod !== wantMod || otherMod || event.shiftKey !== wantShift || event.altKey !== wantAlt) {
    return false
  }
  const main = keys.find((key) => !['mod', 'shift', 'alt'].includes(key))
  if (main === undefined) return false
  if (main === 'esc') return event.key === 'Escape'
  // `code` keeps Shift+digit / layout differences from breaking digit and slash bindings.
  if (/^[0-9]$/.test(main)) return event.code === `Digit${main}`
  if (main === '/') return event.code === 'Slash' || event.key === '/'
  if (main === ',') return event.code === 'Comma' || event.key === ','
  if (main === ']') return event.code === 'BracketRight'
  if (main === '[') return event.code === 'BracketLeft'
  return event.key.toLowerCase() === main
}

/**
 * True when focus is inside the terminal. Ctrl-based chords belong to the shell there
 * (Ctrl+L clears, Ctrl+K kills a line), so on Windows/Linux the app leaves them alone.
 */
export function isTerminalFocused(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('.xterm') !== null
}
