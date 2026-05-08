import { CornerDownLeft, Loader2, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Terminal } from '@xterm/xterm'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { useAuth } from '@/stores/auth'
import { useAiSettings } from '@/features/vault/hooks'
import { adapterFor, type AdapterConfig, type ChatMessage } from './adapters'
import { readRecentLines } from './recentLines'

export type PendingPrompt = {
  /** Prompt text to send (a slash-command + context, typically). */
  text: string
  /**
   * Monotonically increasing token. The panel ignores prompts whose nonce
   * matches the last one it handled, so re-renders never re-submit.
   */
  nonce: number
}

type AskAiPanelProps = {
  open: boolean
  onClose: () => void
  /** Live ref into the active xterm — used to capture context lines. */
  terminalRef: { current: Terminal | null }
  /** Friendly label shown next to the model badge. */
  sessionLabel: string
  /**
   * When this changes (new nonce), the panel auto-submits the supplied text.
   * Used by the "Explain command" right-click flow to dispatch a chat
   * without the user having to type or press Enter.
   */
  pendingPrompt?: PendingPrompt | null
}

type ChatBubble = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  /** True while the assistant text is still streaming in. */
  streaming?: boolean
}

const SLASH_COMMANDS: ReadonlyArray<{ prefix: string; description: string }> = [
  { prefix: '/explain', description: 'Explain the most recent command and its output' },
  { prefix: '/fix', description: 'Suggest a fix for the last error in the terminal' },
  { prefix: '/diagnose', description: 'Diagnose what went wrong from the recent output' },
]

export function AskAiPanel({
  open,
  onClose,
  terminalRef,
  sessionLabel,
  pendingPrompt = null,
}: AskAiPanelProps) {
  const hasPermission = useAuth((s) => s.hasPermission)
  const settingsQuery = useAiSettings()
  const settings = settingsQuery.data ?? null

  const [draft, setDraft] = useState('')
  const [bubbles, setBubbles] = useState<ChatBubble[]>([])
  const [submitting, setSubmitting] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const adapter = useMemo(
    () => (settings === null ? null : adapterFor(settings.provider)),
    [settings],
  )
  const enabled = settings !== null && settings.features.askPanel
  const userHasPermission = hasPermission('ai.use')

  // We store the live history in a ref alongside React state so the
  // pendingPrompt effect can compose messages from the latest history
  // without depending on (and therefore restarting on) every bubble change.
  const bubblesRef = useRef<ChatBubble[]>(bubbles)
  bubblesRef.current = bubbles

  // Auto-submit any prompt the parent queues. The handledNonce ref means
  // re-renders never re-fire the effect for the same nonce.
  const handledNonceRef = useRef<number | null>(null)
  useEffect(() => {
    if (!open || pendingPrompt === null) return
    if (settings === null || adapter === null) return
    if (handledNonceRef.current === pendingPrompt.nonce) return
    handledNonceRef.current = pendingPrompt.nonce
    void sendText(pendingPrompt.text)
    // sendText is defined inside the component but doesn't change identity
    // relevant to this effect; we intentionally only depend on the nonce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pendingPrompt, settings, adapter])

  if (!open) return null

  async function sendText(text: string): Promise<void> {
    if (settings === null || adapter === null) return
    const trimmed = text.trim()
    if (trimmed === '') return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const userBubble: ChatBubble = { id: makeId(), role: 'user', content: trimmed }
    const assistantBubble: ChatBubble = {
      id: makeId(),
      role: 'assistant',
      content: '',
      streaming: true,
    }
    setBubbles((current) => [...current, userBubble, assistantBubble])
    setDraft('')
    setSubmitting(true)

    const recent = settings.features.sendOutputContext
      ? readRecentLines(terminalRef.current, 50)
      : []
    const messages = composeMessages([...bubblesRef.current, userBubble], recent, sessionLabel)
    const config: AdapterConfig = {
      endpoint: settings.endpoint || adapter.defaultEndpoint,
      model: settings.model || adapter.defaultModel,
      apiKey: settings.apiKey,
    }

    let buffered = ''
    try {
      for await (const chunk of adapter.chat({ messages, signal: controller.signal }, config)) {
        if (chunk.kind === 'text') {
          buffered += chunk.delta
          setBubbles((current) =>
            current.map((bubble) =>
              bubble.id === assistantBubble.id ? { ...bubble, content: buffered } : bubble,
            ),
          )
        } else if (chunk.kind === 'error') {
          setBubbles((current) =>
            current.map((bubble) =>
              bubble.id === assistantBubble.id
                ? { ...bubble, content: chunk.message, streaming: false, role: 'system' }
                : bubble,
            ),
          )
          return
        } else if (chunk.kind === 'done') {
          setBubbles((current) =>
            current.map((bubble) =>
              bubble.id === assistantBubble.id ? { ...bubble, streaming: false } : bubble,
            ),
          )
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Stream interrupted.'
      setBubbles((current) =>
        current.map((bubble) =>
          bubble.id === assistantBubble.id
            ? { ...bubble, content: message, streaming: false, role: 'system' }
            : bubble,
        ),
      )
    } finally {
      setSubmitting(false)
      abortRef.current = null
    }
  }

  async function send(): Promise<void> {
    await sendText(draft)
  }

  function applySlashCommand(prefix: string): void {
    setDraft((current) => (current.trim() === '' ? `${prefix} ` : current))
  }

  function cancelStreaming(): void {
    abortRef.current?.abort()
  }

  return (
    <aside className="flex h-full w-[380px] min-h-0 flex-col border-l border-border bg-bg-elev">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="rounded-md bg-accent-soft p-1 text-accent">
          <Sparkles size={13} />
        </span>
        <span className="text-[13px] font-medium text-fg">Ask AI</span>
        {settings !== null && (
          <span className="font-mono text-[11px] text-fg-faint">
            {settings.provider} · {settings.model || adapter?.defaultModel}
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          className="ml-auto text-fg-faint hover:text-fg"
          aria-label="Close Ask AI panel"
        >
          <X size={14} />
        </button>
      </header>

      {!userHasPermission ? (
        <PanelMessage
          title="AI is disabled for this account"
          body="Ask an admin to grant the `ai.use` permission to enable AI features."
        />
      ) : settings === null ? (
        <PanelMessage
          title="No AI provider configured"
          body="Open Settings → AI to point Trominal at your provider and feature toggles."
        />
      ) : !enabled ? (
        <PanelMessage
          title="Ask AI panel is disabled"
          body="Toggle “Ask AI panel” on in Settings → AI to use this surface."
        />
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
            {bubbles.length === 0 && (
              <div className="rounded-md border border-border-subtle bg-surface px-3 py-3 text-[12px] text-fg-faint">
                Type a question or use a slash command.{' '}
                {settings.features.sendOutputContext
                  ? 'The last 50 lines of terminal output are attached automatically.'
                  : 'Toggle “Send terminal output as context” in Settings → AI to include recent output.'}
              </div>
            )}
            {bubbles.map((bubble) => (
              <article
                key={bubble.id}
                className={cn(
                  'mb-3 rounded-md px-3 py-2 text-[12px] leading-relaxed',
                  bubble.role === 'user'
                    ? 'border border-border-subtle bg-surface text-fg'
                    : bubble.role === 'system'
                      ? 'border border-danger bg-danger-soft text-fg'
                      : 'bg-surface-2 text-fg',
                )}
              >
                <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-fg-faint">
                  {bubble.role === 'user' ? 'You' : bubble.role === 'system' ? 'Error' : 'AI'}
                  {bubble.streaming === true ? ' · streaming…' : ''}
                </div>
                <div className="whitespace-pre-wrap font-mono text-[12px]">{bubble.content}</div>
              </article>
            ))}
          </div>

          <footer className="flex flex-col gap-2 border-t border-border px-3 py-2">
            <div className="flex flex-wrap gap-1">
              {SLASH_COMMANDS.map((command) => (
                <button
                  key={command.prefix}
                  type="button"
                  onClick={() => applySlashCommand(command.prefix)}
                  className="rounded-sm border border-border-subtle bg-surface px-2 py-0.5 font-mono text-[11px] text-fg-muted hover:bg-surface-2 hover:text-fg"
                  title={command.description}
                >
                  {command.prefix}
                </button>
              ))}
              {settings.features.sendOutputContext && (
                <span className="ml-auto rounded-sm border border-accent-ring bg-accent-soft px-2 py-0.5 font-mono text-[10px] text-accent">
                  + last 50 lines
                </span>
              )}
            </div>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  if (!submitting) {
                    void send()
                  }
                }
              }}
              rows={3}
              className="w-full resize-none rounded-md border border-border-strong bg-surface px-2.5 py-2 font-mono text-[12px] text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent-ring"
              placeholder="Ask anything or pick a slash command…"
            />
            <div className="flex items-center gap-2">
              {submitting && (
                <Button size="sm" variant="outline" onClick={cancelStreaming}>
                  Stop
                </Button>
              )}
              <Button
                size="sm"
                disabled={submitting || draft.trim() === ''}
                onClick={() => void send()}
              >
                {submitting ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <CornerDownLeft size={13} />
                )}
                Send
              </Button>
            </div>
          </footer>
        </>
      )}
    </aside>
  )
}

function PanelMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-fg-muted">
      <Sparkles size={18} className="text-fg-faint" />
      <h3 className="text-[14px] font-medium text-fg">{title}</h3>
      <p className="max-w-xs text-[12px] leading-relaxed">{body}</p>
    </div>
  )
}

function makeId(): string {
  return `bubble-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Build the message array sent to the adapter from the current chat history,
 * the optional recent terminal lines, and a small system prompt. Slash
 * commands are kept verbatim — the model handles them, since each provider
 * understands "/explain" etc. better than a templated rewrite.
 */
function composeMessages(
  history: ChatBubble[],
  recentLines: string[],
  sessionLabel: string,
): ChatMessage[] {
  const systemParts: string[] = [
    'You are Trominal’s in-app SSH assistant. Be concise. Prefer code blocks for shell commands.',
    `Active session: ${sessionLabel}.`,
  ]
  if (recentLines.length > 0) {
    systemParts.push(
      'The user attached the most recent terminal output below. Use it as context when relevant.',
      '```\n' + recentLines.join('\n') + '\n```',
    )
  }
  const messages: ChatMessage[] = [{ role: 'system', content: systemParts.join('\n\n') }]
  for (const bubble of history) {
    if (bubble.role === 'system') continue
    messages.push({ role: bubble.role, content: bubble.content })
  }
  return messages
}
