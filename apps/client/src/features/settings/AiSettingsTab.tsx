import { useMemo, useState, type KeyboardEvent } from 'react'
import { Check, Eye, EyeOff, Key, Loader2, RefreshCw, Search, Sparkles } from 'lucide-react'
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
import { ADAPTERS, adapterFor, collectChatText, type ModelInfo } from '@/features/ai/adapters'

const PROVIDER_ORDER: AiProvider[] = ['anthropic', 'openai', 'ollama', 'custom']

/** Local servers (Ollama) and many gateways work without a key. */
const KEY_OPTIONAL: ReadonlySet<AiProvider> = new Set(['ollama', 'custom'])

/** Shown on the provider cards instead of a model name. */
const PROVIDER_HINTS: Record<AiProvider, string> = {
  anthropic: 'api.anthropic.com',
  openai: 'OpenAI, OpenRouter, Groq…',
  ollama: 'localhost:11434',
  custom: 'Any OpenAI-compatible URL',
}

function hostOf(endpoint: string): string {
  try {
    return new URL(endpoint).host
  } catch {
    return endpoint
  }
}

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

type ModelsState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; models: ModelInfo[] }
  | { kind: 'error'; message: string }

export function AiSettingsTab() {
  const settingsQuery = useAiSettings()
  const saveSettings = useSaveAiSettings()

  const [draft, setDraft] = useState<AiSettingsInput>(defaultAiSettingsInput())
  const [showApiKey, setShowApiKey] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [connection, setConnection] = useState<ConnectionState>({ kind: 'idle' })
  const [models, setModels] = useState<ModelsState>({ kind: 'idle' })
  const [modelFilter, setModelFilter] = useState('')
  const [manualModel, setManualModel] = useState(false)

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
    if (provider === draft.provider) return
    setDraft((current) => ({
      ...current,
      provider,
      // Endpoints and model ids are provider-specific; start clean on a switch.
      endpoint: '',
      model: '',
    }))
    setConnection({ kind: 'idle' })
    setModels({ kind: 'idle' })
    setManualModel(false)
  }

  /** Endpoint or key changed: the fetched list may no longer apply. */
  function editConnection(patch: Partial<Pick<AiSettingsInput, 'endpoint' | 'apiKey'>>): void {
    setDraft((current) => ({ ...current, ...patch }))
    setConnection({ kind: 'idle' })
    if (models.kind !== 'idle') setModels({ kind: 'idle' })
  }

  async function fetchModels(): Promise<void> {
    setModels({ kind: 'loading' })
    const config = {
      endpoint: draft.endpoint || adapter.defaultEndpoint,
      model: draft.model,
      apiKey: draft.apiKey,
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    try {
      const list = await adapter.listModels(config, controller.signal)
      if (list.length === 0) {
        setModels({
          kind: 'error',
          message: 'This endpoint returned no models. Enter the model ID manually.',
        })
        return
      }
      setModels({ kind: 'loaded', models: list })
      setModelFilter('')
      setManualModel(false)
      // Keep the saved model if this endpoint still offers it; otherwise make the user choose.
      if (!list.some((model) => model.id === draft.model)) {
        setDraft((current) => ({ ...current, model: '' }))
      }
    } catch (err) {
      setModels({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not fetch models.',
      })
    } finally {
      clearTimeout(timer)
    }
  }

  async function save(): Promise<void> {
    setStatus(null)
    if (draft.model.trim() === '') {
      setStatus('Pick a model first.')
      return
    }
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
      model: draft.model,
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

  const keyRequired = !KEY_OPTIONAL.has(draft.provider)
  const canFetch = !keyRequired || draft.apiKey.trim() !== ''
  const endpointHost = hostOf(draft.endpoint || adapter.defaultEndpoint || 'your endpoint')
  const hasModel = draft.model.trim() !== ''

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
                <span className="text-[11px] text-fg-faint">{PROVIDER_HINTS[provider]}</span>
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
          onChange={(event) => editConnection({ endpoint: event.target.value })}
          placeholder={adapter.defaultEndpoint || 'https://api.example.com/v1'}
          hint={
            adapter.defaultEndpoint
              ? `Leave blank to use ${adapter.defaultEndpoint}.`
              : 'The base URL, ending before /chat/completions.'
          }
        />
        <TextInput
          label={keyRequired ? 'API key' : 'API key (optional)'}
          type={showApiKey ? 'text' : 'password'}
          mono
          icon={<Key size={14} />}
          value={draft.apiKey}
          onChange={(event) => editConnection({ apiKey: event.target.value })}
          placeholder={keyRequired ? 'sk-...' : 'Only if your server needs one'}
          autoComplete="off"
          spellCheck={false}
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
          hint="Encrypted in your vault. It's only sent to the endpoint above."
        />
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="ai-model-label">
        <div className="flex items-center justify-between gap-3">
          <span id="ai-model-label" className="text-[12px] font-medium text-fg-muted">
            Model
          </span>
          <Button
            size="sm"
            variant={models.kind === 'loaded' ? 'outline' : 'primary'}
            onClick={() => void fetchModels()}
            disabled={!canFetch || models.kind === 'loading'}
            title={canFetch ? `List the models ${endpointHost} offers` : 'Enter your API key first'}
          >
            {models.kind === 'loading' ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <RefreshCw size={13} />
            )}
            {models.kind === 'loaded' ? 'Refresh' : 'Fetch models'}
          </Button>
        </div>

        {models.kind === 'loaded' && !manualModel ? (
          <ModelPicker
            models={models.models}
            value={draft.model}
            filter={modelFilter}
            onFilter={setModelFilter}
            onPick={(model) => {
              setDraft((current) => ({ ...current, model }))
              setConnection({ kind: 'idle' })
            }}
          />
        ) : manualModel ? (
          <TextInput
            label="Model ID"
            mono
            value={draft.model}
            onChange={(event) => setDraft({ ...draft, model: event.target.value })}
            placeholder="exact id the endpoint expects"
            autoFocus
          />
        ) : (
          <div
            role="status"
            className="flex items-center gap-2 rounded-md border border-dashed border-border-strong bg-surface px-3 py-3 text-[12px] text-fg-muted"
          >
            {models.kind === 'loading' ? (
              <>
                <Loader2 size={13} className="animate-spin text-fg-faint" />
                Fetching models from {endpointHost}…
              </>
            ) : hasModel ? (
              <>
                <Check size={13} className="text-accent" />
                <span>
                  Using <span className="font-mono text-fg">{draft.model}</span>. Fetch models to
                  change it.
                </span>
              </>
            ) : canFetch ? (
              `Fetch models to see what ${endpointHost} offers, then pick one.`
            ) : (
              'Enter your API key, then fetch the models it can use.'
            )}
          </div>
        )}

        {models.kind === 'error' && (
          <span role="alert" className="text-[12px] text-danger">
            {models.message}
          </span>
        )}
        <button
          type="button"
          onClick={() => setManualModel((value) => !value)}
          className="self-start text-[12px] text-fg-faint underline-offset-2 hover:text-fg hover:underline"
        >
          {manualModel
            ? models.kind === 'loaded'
              ? 'Back to the model list'
              : 'Hide manual entry'
            : 'Enter a model ID manually'}
        </button>
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
        <Button onClick={() => void save()} disabled={saveSettings.isPending || !hasModel}>
          {saveSettings.isPending ? <Loader2 size={13} className="animate-spin" /> : null}
          Save
        </Button>
        <Button
          variant="outline"
          onClick={() => void testConnection()}
          disabled={connection.kind === 'testing' || !hasModel}
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

/**
 * Filterable single-select list of the models an endpoint reported. Arrow keys move the
 * selection, like a native listbox.
 */
function ModelPicker({
  models,
  value,
  filter,
  onFilter,
  onPick,
}: {
  models: ModelInfo[]
  value: string
  filter: string
  onFilter: (value: string) => void
  onPick: (id: string) => void
}) {
  const query = filter.trim().toLowerCase()
  const shown =
    query === ''
      ? models
      : models.filter((model) => `${model.id} ${model.label ?? ''}`.toLowerCase().includes(query))

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    if (shown.length === 0) return
    const index = shown.findIndex((model) => model.id === value)
    const step = event.key === 'ArrowDown' ? 1 : -1
    const next = shown[index === -1 ? 0 : (index + step + shown.length) % shown.length]
    onPick(next.id)
    event.currentTarget.querySelector(`[data-id="${CSS.escape(next.id)}"]`)?.scrollIntoView({
      block: 'nearest',
    })
  }

  return (
    <div className="overflow-hidden rounded-md border border-border-input bg-surface">
      <div className="flex items-center gap-2 border-b border-border-subtle px-3">
        <Search size={13} aria-hidden className="text-fg-faint" />
        <input
          value={filter}
          onChange={(event) => onFilter(event.target.value)}
          placeholder={`Filter ${models.length} models`}
          aria-label="Filter models"
          className="h-9 min-w-0 flex-1 bg-transparent text-[12px] text-fg outline-none placeholder:text-fg-faint"
        />
      </div>
      <div
        role="listbox"
        aria-labelledby="ai-model-label"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="max-h-64 overflow-y-auto py-1 outline-none focus-visible:bg-surface-2/40"
      >
        {shown.length === 0 ? (
          <div className="px-3 py-2 text-[12px] text-fg-faint">No model matches “{filter}”.</div>
        ) : (
          shown.map((model) => {
            const selected = model.id === value
            return (
              <div
                key={model.id}
                data-id={model.id}
                role="option"
                aria-selected={selected}
                onClick={() => onPick(model.id)}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-[12px]',
                  selected ? 'bg-accent-soft text-fg' : 'text-fg-muted hover:bg-surface-2',
                )}
              >
                <Check
                  size={13}
                  aria-hidden
                  className={cn('shrink-0 text-accent', !selected && 'invisible')}
                />
                {model.label !== undefined && model.label !== model.id ? (
                  <>
                    <span className="truncate text-fg">{model.label}</span>
                    <span className="ml-auto truncate font-mono text-[11px] text-fg-faint">
                      {model.id}
                    </span>
                  </>
                ) : (
                  <span className="truncate font-mono text-fg">{model.id}</span>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[12px] font-medium text-fg-muted">{children}</span>
}

function normalize(input: AiSettingsInput): AiSettingsInput {
  return {
    ...input,
    endpoint: input.endpoint.trim(),
    model: input.model.trim(),
    apiKey: input.apiKey,
  }
}
