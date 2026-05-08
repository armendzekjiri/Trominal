import { Code2, Copy, Loader2, Play, Plus, Search, Sparkles, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { cn } from '@/lib/cn'
import { useAuth } from '@/stores/auth'
import { useDeleteSnippet, useSaveSnippet, useSnippets } from '@/features/vault/hooks'
import {
  extractVariables,
  substituteVariables,
  tagsFromInput,
  type SnippetInput,
  type SnippetItem,
} from '@/features/vault/model'
import { SnippetGenerator } from './SnippetGenerator'

const EMPTY_SNIPPET: SnippetInput = {
  title: '',
  body: 'kubectl logs -n {{namespace}} -l app={{app}} --tail={{lines}} -f',
  tags: ['ops'],
}

function snippetToInput(snippet: SnippetItem): SnippetInput {
  return {
    id: snippet.id,
    title: snippet.title,
    body: snippet.body,
    tags: snippet.tags,
  }
}

function MarkdownPreview({ body }: { body: string }) {
  const lines = body.split('\n')
  return (
    <div className="space-y-2 text-[13px] leading-6 text-fg">
      {lines.map((line, index) => {
        const key = `${index}:${line}`
        if (line.startsWith('# ')) {
          return (
            <h3 key={key} className="text-[15px] font-semibold text-fg">
              {line.slice(2)}
            </h3>
          )
        }
        if (line.startsWith('- ')) {
          return (
            <div key={key} className="pl-3 text-fg-muted">
              - {line.slice(2)}
            </div>
          )
        }
        return (
          <pre
            key={key}
            className="overflow-auto whitespace-pre-wrap font-mono text-[12px] text-fg"
          >
            {line || ' '}
          </pre>
        )
      })}
    </div>
  )
}

export function SnippetsPage() {
  const snippetsQuery = useSnippets()
  const saveSnippet = useSaveSnippet()
  const deleteSnippet = useDeleteSnippet()
  const snippets = snippetsQuery.data ?? []
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<SnippetInput>(EMPTY_SNIPPET)
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const canUseAi = useAuth((s) => s.hasPermission('ai.use'))

  const visible = snippets.filter((snippet) =>
    [snippet.title, snippet.body, snippet.tags.join(' ')]
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase()),
  )
  const variableNames = extractVariables(draft.body)
  const rendered = substituteVariables(draft.body, variables)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await saveSnippet.mutateAsync(draft)
  }

  function updateVariable(name: string, value: string): void {
    setVariables((current) => ({ ...current, [name]: value }))
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[300px_1fr] bg-bg">
      <aside className="flex min-h-0 flex-col border-r border-border bg-bg-elev">
        <div className="flex gap-2 border-b border-border p-3">
          <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-border-strong bg-surface px-2.5">
            <Search size={13} className="text-fg-faint" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search snippets"
              className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-fg-faint"
            />
          </div>
          <Button size="sm" onClick={() => setDraft(EMPTY_SNIPPET)} aria-label="New snippet">
            <Plus size={13} />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {snippetsQuery.isLoading ? (
            <div className="flex items-center gap-2 px-2 py-3 text-[12px] text-fg-faint">
              <Loader2 size={13} className="animate-spin" />
              Loading snippets
            </div>
          ) : (
            visible.map((snippet) => (
              <button
                key={snippet.id}
                type="button"
                onClick={() => setDraft(snippetToInput(snippet))}
                className={cn(
                  'mb-1 w-full rounded-md border-l-2 px-2 py-2 text-left',
                  draft.id === snippet.id
                    ? 'border-accent bg-surface-3'
                    : 'border-transparent hover:bg-surface-2',
                )}
              >
                <div className="flex items-center gap-2">
                  <Code2 size={13} className="text-accent" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                    {snippet.title}
                  </span>
                </div>
                <div className="mt-1 line-clamp-2 pl-5 font-mono text-[11px] text-fg-faint">
                  {snippet.body}
                </div>
                <div className="mt-2 flex flex-wrap gap-1 pl-5">
                  {snippet.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-sm border border-border-subtle bg-surface px-1.5 py-0.5 font-mono text-[10px] text-fg-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="relative grid min-h-0 grid-rows-[auto_1fr]">
        <form
          onSubmit={(event) => void submit(event)}
          className="flex items-center gap-3 border-b border-border px-4 py-3"
        >
          <Code2 size={15} className="text-accent" />
          <input
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            placeholder="Snippet title"
            required
            className="min-w-0 flex-1 bg-transparent text-[14px] font-medium outline-none placeholder:text-fg-faint"
          />
          {canUseAi && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setGeneratorOpen((open) => !open)}
              aria-pressed={generatorOpen}
            >
              <Sparkles size={13} />
              Generate
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void navigator.clipboard.writeText(rendered)}
          >
            <Copy size={13} />
            Copy
          </Button>
          <Button type="button" variant="outline" size="sm">
            <Play size={13} />
            Run
          </Button>
          <Button size="sm" disabled={saveSnippet.isPending}>
            Save
          </Button>
          {draft.id !== undefined && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                void deleteSnippet.mutateAsync(draft.id ?? '').then(() => setDraft(EMPTY_SNIPPET))
              }
            >
              <Trash2 size={13} />
            </Button>
          )}
        </form>

        {generatorOpen && (
          <SnippetGenerator
            onApply={(input) => {
              setDraft({ ...input, id: undefined })
              setVariables({})
            }}
            onClose={() => setGeneratorOpen(false)}
          />
        )}

        <div className="grid min-h-0 grid-cols-2">
          <div className="flex min-h-0 flex-col border-r border-border">
            <div className="border-b border-border-subtle px-4 py-2 text-[11px] uppercase tracking-wide text-fg-faint">
              Source
            </div>
            <textarea
              value={draft.body}
              onChange={(event) => setDraft({ ...draft, body: event.target.value })}
              className="min-h-0 flex-1 resize-none bg-ansi-black p-4 font-mono text-[13px] leading-6 text-fg outline-none"
            />
            <div className="border-t border-border-subtle p-3">
              <TextInput
                label="Tags"
                value={draft.tags.join(', ')}
                onChange={(event) =>
                  setDraft({ ...draft, tags: tagsFromInput(event.target.value) })
                }
                placeholder="k8s, ops"
              />
            </div>
          </div>

          <div className="flex min-h-0 flex-col">
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2 text-[11px] uppercase tracking-wide text-fg-faint">
              <span>Preview</span>
              <span className="text-accent">{variableNames.length} variables</span>
            </div>
            {variableNames.length > 0 && (
              <div className="grid grid-cols-2 gap-2 border-b border-border-subtle p-3">
                {variableNames.map((name) => (
                  <TextInput
                    key={name}
                    label={name}
                    value={variables[name] ?? ''}
                    onChange={(event) => updateVariable(name, event.target.value)}
                    placeholder={`{{${name}}}`}
                    mono
                  />
                ))}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-auto p-4">
              <MarkdownPreview body={rendered} />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
