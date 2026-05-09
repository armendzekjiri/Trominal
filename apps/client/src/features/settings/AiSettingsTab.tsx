import { useMemo, useState } from 'react'
import { Eye, EyeOff, Key, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { cn } from '@/lib/cn'
import { useAiSettings, useSaveAiSettings } from '@/features/vault/hooks'
import {
  defaultAiSettingsInput,
  type AiFeatureToggles,
  type AiProvider,
  type AiSettingsInput,
} from '@/features/vault/model'
import { ADAPTERS, adapterFor, collectChatText } from '@/features/ai/adapters'

const PROVIDER_ORDER: AiProvider[] = ['anthropic', 'openai', 'ollama', 'custom']

const FEATURE_LABELS: Record<keyof AiFeatureToggles, { label: string; description: string }> = {
  inlineSuggestions: {
    label: 'Inline command suggestions',
    description: 'Ghost-text completion in the terminal. Tab to accept, Esc to dismiss. (Phase 7B)',
  },
  autoSuggest: {
    label: 'Auto-suggest while typing',
    description:
      'Trigger inline suggestions automatically when you pause typing. Suppressed inside vim/tmux and at password prompts. Sends an API request per typing pause, so it can add up — leave off if you watch your spend. Requires inline command suggestions.',
  },
  askPanel: {
    label: 'Ask AI panel',
    description: 'Slide-in chat in the terminal workspace. Available now.',
  },
  explainCommand: {
    label: 'Explain command (right-click)',
    description: 'Right-click a selection in the terminal to ask "what does this do?". (Phase 7B)',
  },
  sendOutputContext: {
    label: 'Send terminal output as context',
    description:
      'Attach the last 50 lines of the active session to AI requests. Useful for diagnostics; off by default for privacy.',
  },
}

type ConnectionState =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'ok'; sample: string }
  | { kind: 'error'; message: string }

export function AiSettingsTab() {
  const settingsQuery = useAiSettings()
  const saveSettings = useSaveAiSettings()

  const [draft, setDraft] = useState<AiSettingsInput>(defaultAiSettingsInput())
  const [showApiKey, setShowApiKey] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [connection, setConnection] = useState<ConnectionState>({ kind: 'idle' })

  // Hydrate the form when the vault returns a persisted record. The
  // "adjust state during render" pattern keeps the lint rule happy and is
  // what React docs recommend for query-derived state — we sync the form
  // only when we transition into having a new record id, so live edits are
  // never clobbered by a re-fetch.
  const [hydratedFor, setHydratedFor] = useState<string | null>(null)
  if (settingsQuery.data !== undefined) {
    const incomingId = settingsQuery.data?.id ?? '__empty__'
    if (hydratedFor !== incomingId) {
      setHydratedFor(incomingId)
      if (settingsQuery.data !== null) {
        setDraft({
          id: settingsQuery.data.id,
          provider: settingsQuery.data.provider,
          endpoint: settingsQuery.data.endpoint,
          model: settingsQuery.data.model,
          apiKey: settingsQuery.data.apiKey,
          features: settingsQuery.data.features,
        })
      }
    }
  }

  const adapter = useMemo(() => adapterFor(draft.provider), [draft.provider])

  function pickProvider(provider: AiProvider): void {
    const next = adapterFor(provider)
    setDraft((current) => ({
      ...current,
      provider,
      // When the user switches providers, push the adapter's defaults into
      // empty fields without overwriting anything they typed.
      endpoint: current.endpoint || next.defaultEndpoint,
      model: current.model || next.defaultModel,
    }))
    setConnection({ kind: 'idle' })
  }

  async function save(): Promise<void> {
    setStatus(null)
    try {
      await saveSettings.mutateAsync(normalize(draft))
      setStatus('Saved.')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not save AI settings.')
    }
  }

  async function testConnection(): Promise<void> {
    setConnection({ kind: 'testing' })
    const config = {
      endpoint: draft.endpoint || adapter.defaultEndpoint,
      model: draft.model || adapter.defaultModel,
      apiKey: draft.apiKey,
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20_000)
    try {
      const stream = adapter.chat(
        {
          messages: [
            {
              role: 'user',
              content: 'Reply with the single word "pong" so we can verify the connection.',
            },
          ],
          maxOutputTokens: 16,
          signal: controller.signal,
        },
        config,
      )
      const sample = (await collectChatText(stream)).trim()
      setConnection({ kind: 'ok', sample: sample === '' ? 'OK' : sample })
    } catch (err) {
      setConnection({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Connection failed.',
      })
    } finally {
      clearTimeout(timer)
    }
  }

  function toggleFeature(key: keyof AiFeatureToggles): void {
    setDraft((current) => ({
      ...current,
      features: { ...current.features, [key]: !current.features[key] },
    }))
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <header className="flex items-start gap-3">
        <span className="rounded-md bg-accent-soft p-2 text-accent">
          <Sparkles size={16} />
        </span>
        <div>
          <h1 className="text-[18px] font-semibold">AI integration</h1>
          <p className="mt-1 text-[12px] text-fg-muted">
            Bring your own provider. API keys are encrypted client-side and stored in your vault;
            requests go directly from the desktop or web client to the provider — never through
            Trominal's backend.
          </p>
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <SectionLabel>Provider</SectionLabel>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PROVIDER_ORDER.map((provider) => {
            const def = ADAPTERS[provider]
            const selected = draft.provider === provider
            return (
              <button
                key={provider}
                type="button"
                onClick={() => pickProvider(provider)}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-md border px-3 py-2.5 text-left text-[12px] transition-colors',
                  selected
                    ? 'border-accent-ring bg-accent-soft text-fg'
                    : 'border-border-strong bg-surface text-fg-muted hover:bg-surface-2',
                )}
              >
                <span className="font-medium text-fg">{def.label}</span>
                <span className="font-mono text-[11px] text-fg-faint">
                  {def.defaultModel || 'custom model'}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <TextInput
          label="Endpoint"
          mono
          value={draft.endpoint}
          onChange={(event) => setDraft({ ...draft, endpoint: event.target.value })}
          placeholder={adapter.defaultEndpoint || 'https://api.example.com/v1'}
          hint={`Leave blank to use ${adapter.defaultEndpoint || 'the provider default'}.`}
        />
        <TextInput
          label="Model"
          mono
          value={draft.model}
          onChange={(event) => setDraft({ ...draft, model: event.target.value })}
          placeholder={adapter.defaultModel || 'model name'}
        />
        <TextInput
          label="API key"
          type={showApiKey ? 'text' : 'password'}
          mono
          icon={<Key size={14} />}
          value={draft.apiKey}
          onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
          placeholder={draft.provider === 'ollama' ? 'optional for local Ollama' : 'sk-...'}
          suffix={
            <button
              type="button"
              onClick={() => setShowApiKey((value) => !value)}
              className="cursor-pointer"
              aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
            >
              {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          }
          hint="Stored encrypted in your vault — the key never leaves the device in plaintext."
        />
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel>Features</SectionLabel>
        <div className="flex flex-col divide-y divide-border-subtle overflow-hidden rounded-md border border-border bg-surface">
          {(Object.keys(FEATURE_LABELS) as Array<keyof AiFeatureToggles>).map((key) => (
            <label
              key={key}
              className="flex items-start gap-3 px-3 py-2.5 text-[12px] hover:bg-surface-2"
            >
              <input
                type="checkbox"
                checked={draft.features[key]}
                onChange={() => toggleFeature(key)}
                className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
              />
              <span className="flex flex-col">
                <span className="text-[13px] text-fg">{FEATURE_LABELS[key].label}</span>
                <span className="text-[11px] text-fg-faint">{FEATURE_LABELS[key].description}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="flex items-center gap-3">
        <Button onClick={() => void save()} disabled={saveSettings.isPending}>
          {saveSettings.isPending ? <Loader2 size={13} className="animate-spin" /> : null}
          Save
        </Button>
        <Button
          variant="outline"
          onClick={() => void testConnection()}
          disabled={connection.kind === 'testing'}
        >
          {connection.kind === 'testing' ? <Loader2 size={13} className="animate-spin" /> : null}
          Test connection
        </Button>
        {connection.kind === 'ok' && (
          <span className="font-mono text-[12px] text-accent">
            ✓ {connection.sample.slice(0, 40)}
          </span>
        )}
        {connection.kind === 'error' && (
          <span className="truncate text-[12px] text-danger">{connection.message}</span>
        )}
        {status !== null && <span className="text-[12px] text-fg-faint">{status}</span>}
      </section>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-wide text-fg-muted">
      {children}
    </span>
  )
}

function normalize(input: AiSettingsInput): AiSettingsInput {
  return {
    ...input,
    endpoint: input.endpoint.trim(),
    model: input.model.trim(),
    apiKey: input.apiKey,
  }
}
