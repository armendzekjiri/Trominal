import { Loader2, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/stores/auth'
import { useAiSettings } from '@/features/vault/hooks'
import type { SnippetInput } from '@/features/vault/model'
import { adapterFor, collectChatText, type AdapterConfig } from '@/features/ai/adapters'
import { buildSnippetPrompt, parseSnippetSuggestion } from '@/features/ai/snippetPrompt'

type Props = {
  /** Called with the parsed suggestion so the page can pre-fill the draft form. */
  onApply: (input: SnippetInput) => void
  /** Closes the popover from the parent. */
  onClose: () => void
}

/**
 * Floating popover that takes a natural-language description, asks the
 * configured AI provider for a structured snippet, and hands the parsed
 * result back to the page. The user reviews / edits before saving — we
 * never persist anything from this dialog directly.
 */
export function SnippetGenerator({ onApply, onClose }: Props) {
  const settings = useAiSettings().data ?? null
  const canUseAi = useAuth((s) => s.hasPermission('ai.use'))
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate(): Promise<void> {
    if (settings === null) return
    const trimmed = description.trim()
    if (trimmed === '') return
    setSubmitting(true)
    setError(null)
    const adapter = adapterFor(settings.provider)
    const config: AdapterConfig = {
      endpoint: settings.endpoint || adapter.defaultEndpoint,
      model: settings.model || adapter.defaultModel,
      apiKey: settings.apiKey,
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    try {
      const stream = adapter.chat(
        {
          messages: [
            {
              role: 'system',
              content: 'You write concise, reusable shell snippets for Trominal.',
            },
            { role: 'user', content: buildSnippetPrompt(trimmed) },
          ],
          maxOutputTokens: 400,
          signal: controller.signal,
        },
        config,
      )
      const text = await collectChatText(stream)
      const parsed = parseSnippetSuggestion(text)
      onApply({
        title: parsed.title,
        body: parsed.body,
        tags: parsed.tags,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Snippet generation failed.')
    } finally {
      clearTimeout(timeout)
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Generate snippet"
      className="absolute right-0 top-12 z-20 w-[360px] rounded-md border border-border bg-bg-elev p-3 shadow-md"
    >
      <header className="flex items-center gap-2 pb-2">
        <span className="rounded-md bg-accent-soft p-1 text-accent">
          <Sparkles size={13} />
        </span>
        <span className="text-[13px] font-medium text-fg">Generate snippet</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto text-fg-faint hover:text-fg"
          aria-label="Close"
        >
          <X size={13} />
        </button>
      </header>

      {!canUseAi ? (
        <p className="px-1 text-[12px] text-fg-muted">
          Snippet generation requires the <code>ai.use</code> permission.
        </p>
      ) : settings === null ? (
        <p className="px-1 text-[12px] text-fg-muted">
          Configure an AI provider in Settings → AI before generating snippets.
        </p>
      ) : (
        <>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            placeholder="Describe what the snippet should do — e.g. follow logs of pods that aren’t ready in a namespace."
            className="w-full resize-none rounded-md border border-border-strong bg-surface px-2.5 py-2 font-mono text-[12px] text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent-ring"
            disabled={submitting}
          />
          {error !== null && (
            <p className="mt-2 rounded-sm border border-danger bg-danger-soft px-2 py-1 text-[11px] text-fg">
              {error}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <Button
              size="sm"
              disabled={submitting || description.trim() === ''}
              onClick={() => void generate()}
            >
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Generate
            </Button>
            <Button size="sm" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
