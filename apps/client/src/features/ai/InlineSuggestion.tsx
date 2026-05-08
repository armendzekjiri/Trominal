import { useEffect, useRef, useState } from 'react'
import type { SshSession } from '@trominal/ssh-transport'
import type { Terminal } from '@xterm/xterm'
import { useAuth } from '@/stores/auth'
import { useAiSettings } from '@/features/vault/hooks'
import { adapterFor, collectChatText, type AdapterConfig } from './adapters'
import { readRecentLines } from './recentLines'

type InlineSuggestionProps = {
  terminal: Terminal
  session: SshSession | null
}

type SuggestionState =
  | { kind: 'idle' }
  | { kind: 'loading'; cellX: number; cellY: number }
  | { kind: 'visible'; text: string; cellX: number; cellY: number }
  | { kind: 'error'; message: string; cellX: number; cellY: number }

const encoder = new TextEncoder()

/**
 * Ctrl+Space-triggered command-suggestion overlay rendered above the active
 * xterm. Manual trigger keeps us out of fights with vim/tmux/sudo prompts
 * that an auto-debounced strategy would lose. Tab accepts the suggestion
 * (writes it through the SSH session), Esc dismisses it.
 *
 * Gated by `ai.use` permission and the `inlineSuggestions` feature toggle —
 * if either is off, the hook installs no key handler and renders nothing.
 */
export function InlineSuggestion({ terminal, session }: InlineSuggestionProps) {
  const settings = useAiSettings().data ?? null
  const hasPermission = useAuth((s) => s.hasPermission)
  const enabled =
    hasPermission('ai.use') && settings !== null && settings.features.inlineSuggestions

  const [state, setState] = useState<SuggestionState>({ kind: 'idle' })
  // Track the in-flight controller so triggering a fresh suggestion or
  // dismissing aborts the previous request without races.
  const abortRef = useRef<AbortController | null>(null)
  // Mirror the latest state so the key-event handler (installed once) can
  // read it without re-binding on every render. Sync from a passive
  // useEffect rather than during render — that's React's recommended
  // pattern for "ref always reflects current state".
  const stateRef = useRef<SuggestionState>(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    if (!enabled || settings === null) return undefined

    const adapter = adapterFor(settings.provider)
    const config: AdapterConfig = {
      endpoint: settings.endpoint || adapter.defaultEndpoint,
      model: settings.model || adapter.defaultModel,
      apiKey: settings.apiKey,
    }

    async function trigger(): Promise<void> {
      const cell = currentCellPosition(terminal)
      if (cell === null) return
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setState({ kind: 'loading', cellX: cell.x, cellY: cell.y })

      const recent = readRecentLines(terminal, 25)
      try {
        const stream = adapter.chat(
          {
            messages: [
              {
                role: 'system',
                content:
                  'You are an AI shell-completion engine. Reply with a SINGLE shell command and nothing else: no explanation, no code fences, no leading prompt characters. The command will be inserted at the user’s cursor.',
              },
              {
                role: 'user',
                content:
                  'Recent terminal output:\n```\n' +
                  recent.join('\n') +
                  '\n```\nSuggest the next shell command.',
              },
            ],
            maxOutputTokens: 80,
            signal: controller.signal,
          },
          config,
        )
        const text = sanitiseSuggestion(await collectChatText(stream))
        if (controller.signal.aborted) return
        if (text === '') {
          setState({ kind: 'idle' })
          return
        }
        setState({ kind: 'visible', text, cellX: cell.x, cellY: cell.y })
      } catch (err) {
        if (controller.signal.aborted) return
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Suggestion failed.',
          cellX: cell.x,
          cellY: cell.y,
        })
      } finally {
        abortRef.current = null
      }
    }

    function dismiss(): void {
      abortRef.current?.abort()
      abortRef.current = null
      setState({ kind: 'idle' })
    }

    function accept(): void {
      const current = stateRef.current
      if (current.kind !== 'visible') return
      session?.write(encoder.encode(current.text))
      setState({ kind: 'idle' })
    }

    const handler = (event: KeyboardEvent): boolean => {
      // Ctrl+Space → suggestion request.
      if (event.ctrlKey && event.code === 'Space' && event.type === 'keydown') {
        event.preventDefault()
        void trigger()
        return false
      }
      const current = stateRef.current
      // Tab to accept while a suggestion is shown.
      if (current.kind === 'visible' && event.key === 'Tab' && event.type === 'keydown') {
        event.preventDefault()
        accept()
        return false
      }
      // Esc dismisses any state but idle (so it never steals a real Esc press).
      if (current.kind !== 'idle' && event.key === 'Escape' && event.type === 'keydown') {
        event.preventDefault()
        dismiss()
        return false
      }
      return true
    }

    terminal.attachCustomKeyEventHandler(handler)
    return () => {
      // No detach API; replace with a permissive no-op handler so the next
      // mount can install its own.
      terminal.attachCustomKeyEventHandler(() => true)
      abortRef.current?.abort()
    }
  }, [terminal, session, enabled, settings])

  if (!enabled || state.kind === 'idle') return null
  return <Overlay terminal={terminal} state={state} />
}

function Overlay({ terminal, state }: { terminal: Terminal; state: SuggestionState }) {
  if (state.kind === 'idle') return null
  const cell = cellSize(terminal)
  const left = state.cellX * cell.width
  const top = state.cellY * cell.height
  const message =
    state.kind === 'loading'
      ? 'AI suggestion · loading…'
      : state.kind === 'error'
        ? `AI · ${state.message}`
        : `${state.text} · Tab to accept · Esc to dismiss`
  return (
    <div
      className="pointer-events-none absolute z-10 max-w-[80%] truncate rounded-sm border border-border-subtle bg-bg-elev/90 px-1.5 py-0.5 font-mono text-[12px] text-fg-muted"
      style={{ left, top, lineHeight: `${cell.height}px` }}
      data-testid="inline-suggestion-overlay"
    >
      {message}
    </div>
  )
}

/** Cell-grid coordinates of the current cursor in viewport space, or null if unavailable. */
function currentCellPosition(terminal: Terminal): { x: number; y: number } | null {
  const buffer = terminal.buffer.active
  // viewportY is the top buffer row of the rendered viewport; cursorY is
  // measured against the viewport in xterm 5+, so this gives a 0..rows-1
  // value safe to multiply by cellHeight.
  const x = buffer.cursorX
  const y = buffer.cursorY
  if (Number.isNaN(x) || Number.isNaN(y)) return null
  return { x, y }
}

export function cellSize(terminal: Terminal): { width: number; height: number } {
  const element = terminal.element
  if (element === undefined || terminal.cols === 0 || terminal.rows === 0) {
    return { width: 0, height: 0 }
  }
  return {
    width: element.clientWidth / terminal.cols,
    height: element.clientHeight / terminal.rows,
  }
}

/**
 * Strip wrappers the model commonly adds even when asked not to: code
 * fences, leading shell prompts, leading "$ " markers, trailing newlines.
 */
export function sanitiseSuggestion(raw: string): string {
  let text = raw.trim()
  // Strip a single ```lang\n ... \n``` fence if present.
  const fenced = /^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```$/.exec(text)
  if (fenced !== null && fenced[1] !== undefined) {
    text = fenced[1].trim()
  }
  // If multi-line, take the first non-empty line — we only want one command.
  const firstLine = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line !== '')
  if (firstLine !== undefined) text = firstLine
  // Drop leading shell-prompt-like tokens.
  text = text.replace(/^(?:\$|>|#|❯|→)\s+/, '')
  return text
}
