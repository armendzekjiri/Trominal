import { Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Terminal } from '@xterm/xterm'
import { cn } from '@/lib/cn'
import { useAuth } from '@/stores/auth'
import { useAiSettings } from '@/features/vault/hooks'

type Props = {
  terminal: Terminal
  /** The HTML element xterm rendered into; the menu positions relative to it. */
  element: HTMLDivElement
  /** Called with the user's selection (or fallback line) when "Explain command" is chosen. */
  onExplain: (text: string) => void
}

type MenuState = { open: false } | { open: true; x: number; y: number; selection: string }

/**
 * Floating right-click menu over the terminal pane offering an
 * "Explain command" action that hands the current selection to the
 * Ask AI panel. Gated by `ai.use` and `features.explainCommand`.
 */
export function TerminalContextMenu({ terminal, element, onExplain }: Props) {
  const settings = useAiSettings().data ?? null
  const canUseAi = useAuth((s) => s.hasPermission('ai.use'))
  const enabled = canUseAi && settings !== null && settings.features.explainCommand

  const [state, setState] = useState<MenuState>({ open: false })

  useEffect(() => {
    if (!enabled) return undefined

    const handleContextMenu = (event: MouseEvent): void => {
      const selection = terminal.getSelection().trim()
      if (selection === '') {
        // Fallback: nothing selected → use the visible cursor row's text so
        // the user can right-click anywhere and still get a useful action.
        const fallback = lastCommandLine(terminal)
        if (fallback === '') return
        event.preventDefault()
        const { x, y } = clampToViewport(event.clientX, event.clientY)
        setState({ open: true, x, y, selection: fallback })
        return
      }
      event.preventDefault()
      const { x, y } = clampToViewport(event.clientX, event.clientY)
      setState({ open: true, x, y, selection })
    }

    const handleDocumentClick = (event: MouseEvent): void => {
      // Close when the user clicks outside the menu, but ignore the synthetic
      // mousedown that opened it.
      if (event.button === 2) return
      setState({ open: false })
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setState({ open: false })
    }

    element.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('mousedown', handleDocumentClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      element.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('mousedown', handleDocumentClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [terminal, element, enabled])

  if (!state.open) return null

  return (
    <div
      role="menu"
      style={{ left: state.x, top: state.y }}
      className={cn(
        'fixed z-30 min-w-[200px] rounded-md border border-border bg-bg-elev p-1 shadow-md',
      )}
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onExplain(state.selection)
          setState({ open: false })
        }}
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[12px] text-fg-muted hover:bg-surface-2 hover:text-fg"
      >
        <Sparkles size={13} className="text-accent" />
        <span className="truncate">
          Explain
          {state.selection.length > 24
            ? ` "${state.selection.slice(0, 24)}…"`
            : ` "${state.selection}"`}
        </span>
      </button>
    </div>
  )
}

/**
 * Read the last visible command line from xterm — used as the fallback
 * "Explain" target when the user right-clicked without a selection.
 */
export function lastCommandLine(terminal: Terminal): string {
  const buffer = terminal.buffer.active
  const total = buffer.length
  for (let row = total - 1; row >= Math.max(0, total - 5); row -= 1) {
    const line = buffer.getLine(row)
    if (line === undefined) continue
    const text = line.translateToString(true).trim()
    if (text === '') continue
    return text
  }
  return ''
}

/** Keep the menu inside the viewport even at the bottom-right corner. */
function clampToViewport(x: number, y: number): { x: number; y: number } {
  const margin = 8
  const maxX = Math.max(margin, window.innerWidth - 220)
  const maxY = Math.max(margin, window.innerHeight - 80)
  return {
    x: Math.min(Math.max(margin, x), maxX),
    y: Math.min(Math.max(margin, y), maxY),
  }
}
