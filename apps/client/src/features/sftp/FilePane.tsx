import {
  ChevronUp,
  FolderClosed,
  FolderUp,
  Home,
  Loader2,
  RefreshCw,
  Slash,
  type LucideIcon,
} from 'lucide-react'
import { File as FileIcon, Link as LinkIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import type { SftpEntry } from './types'

export type FilePaneSide = 'local' | 'remote'

type FilePaneProps = {
  side: FilePaneSide
  title: string
  path: string
  entries: SftpEntry[]
  isLoading: boolean
  error: string | null
  onRefresh: () => void
  onNavigate: (entry: SftpEntry) => void
  onUpDirectory: () => void
  onSelect: (entry: SftpEntry) => void
  selected: SftpEntry | null
  onTransfer: (entry: SftpEntry) => void
  transferLabel: string
  emptyMessage?: string
  /** When provided, enables the Home button. */
  homePath?: string | null
  /** Type-a-path navigation. Called when the user hits Enter in the path bar. */
  onSubmitPath?: (path: string) => void
}

export function FilePane({
  side,
  title,
  path,
  entries,
  isLoading,
  error,
  onRefresh,
  onNavigate,
  onUpDirectory,
  onSelect,
  selected,
  onTransfer,
  transferLabel,
  emptyMessage = 'Empty',
  homePath,
  onSubmitPath,
}: FilePaneProps) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-border bg-bg-elev px-3 py-2">
        <span
          className={cn(
            'inline-flex h-5 items-center gap-1.5 rounded-full border px-2 font-mono text-[11px]',
            side === 'remote'
              ? 'border-accent-ring bg-accent-soft text-fg'
              : 'border-border-strong bg-surface text-fg-muted',
          )}
        >
          {side === 'remote' ? 'remote' : 'local'}
        </span>
        <span className="truncate text-[13px] font-medium text-fg">{title}</span>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading}>
            {isLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          </Button>
        </div>
      </header>

      <PathBar
        path={path}
        onUpDirectory={onUpDirectory}
        onSubmitPath={onSubmitPath}
        homePath={homePath}
        side={side}
      />

      <div className="grid grid-cols-[minmax(0,1fr)_88px_120px] border-b border-border-subtle px-3 py-1.5 text-[11px] uppercase tracking-wide text-fg-faint">
        <span>Name</span>
        <span className="text-right">Size</span>
        <span className="text-right">Modified</span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {error !== null ? (
          <div className="px-3 py-3 text-[12px] text-danger">{error}</div>
        ) : isLoading && entries.length === 0 ? (
          <div className="flex items-center gap-2 px-3 py-3 text-[12px] text-fg-faint">
            <Loader2 size={13} className="animate-spin" /> Loading…
          </div>
        ) : entries.length === 0 ? (
          <div className="px-3 py-3 text-[12px] text-fg-faint">{emptyMessage}</div>
        ) : (
          entries.map((entry) => {
            const Icon = iconFor(entry)
            const isSelected = selected?.name === entry.name
            return (
              <button
                key={`${entry.kind}:${entry.name}`}
                type="button"
                onClick={() => onSelect(entry)}
                onDoubleClick={() => {
                  if (entry.kind === 'dir') {
                    onNavigate(entry)
                  } else {
                    onTransfer(entry)
                  }
                }}
                className={cn(
                  'grid w-full grid-cols-[minmax(0,1fr)_88px_120px] items-center px-3 py-1 text-left text-[12px] hover:bg-surface-2',
                  isSelected ? 'bg-surface-3 text-fg' : 'text-fg-muted',
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Icon
                    size={13}
                    className={
                      entry.kind === 'dir'
                        ? 'shrink-0 text-info'
                        : entry.kind === 'symlink'
                          ? 'shrink-0 text-fg-muted'
                          : 'shrink-0 text-fg-faint'
                    }
                  />
                  <span className="truncate font-mono">{entry.name}</span>
                </span>
                <span className="text-right font-mono text-[11px]">
                  {entry.kind === 'dir' ? '—' : formatBytes(entry.size)}
                </span>
                <span className="truncate text-right font-mono text-[11px] text-fg-faint">
                  {entry.modified}
                </span>
              </button>
            )
          })
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-border bg-bg-elev px-3 py-2 text-[11px] text-fg-faint">
        <span>
          {entries.length} item{entries.length === 1 ? '' : 's'}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={selected === null || selected.kind !== 'file'}
          onClick={() => selected !== null && onTransfer(selected)}
        >
          {transferLabel}
        </Button>
      </footer>
    </section>
  )
}

function PathBar({
  path,
  onUpDirectory,
  onSubmitPath,
  homePath,
  side,
}: {
  path: string
  onUpDirectory: () => void
  onSubmitPath?: (path: string) => void
  homePath?: string | null
  side: FilePaneSide
}) {
  const [draft, setDraft] = useState(path)
  const [editing, setEditing] = useState(false)

  // Keep the input synced with the parent's path when the user isn't typing.
  // This is the documented "adjust state during render" pattern instead of an
  // effect — React reruns the render synchronously, so the input shows the
  // new path immediately after a click on ".." / Home / Root / a folder row.
  const [pathSnapshot, setPathSnapshot] = useState(path)
  if (!editing && path !== pathSnapshot) {
    setPathSnapshot(path)
    setDraft(path)
  }

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (onSubmitPath === undefined) return
    const trimmed = draft.trim()
    if (trimmed === '' || trimmed === path) {
      setEditing(false)
      return
    }
    onSubmitPath(trimmed)
    setEditing(false)
  }

  const submittable = onSubmitPath !== undefined

  return (
    <div className="flex items-center gap-1.5 border-b border-border-subtle bg-surface px-2 py-1.5">
      <Button
        variant="ghost"
        size="sm"
        onClick={onUpDirectory}
        aria-label="Up one directory"
        className="h-6 px-1.5"
      >
        <ChevronUp size={12} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onSubmitPath?.('/')}
        aria-label={`Go to ${side === 'remote' ? 'remote' : 'local'} root`}
        className="h-6 px-1.5"
        disabled={!submittable}
      >
        <Slash size={12} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => homePath !== undefined && homePath !== null && onSubmitPath?.(homePath)}
        aria-label="Go to home"
        className="h-6 px-1.5"
        disabled={!submittable || homePath === null || homePath === undefined}
        title={homePath ?? 'Home unavailable'}
      >
        <Home size={12} />
      </Button>
      <form onSubmit={submit} className="min-w-0 flex-1">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() => setEditing(true)}
          onBlur={(event) => {
            setEditing(false)
            const trimmed = event.target.value.trim()
            if (trimmed !== '' && trimmed !== path && submittable) {
              onSubmitPath?.(trimmed)
            } else {
              setDraft(path)
            }
          }}
          className="w-full bg-transparent font-mono text-[11px] text-fg-muted outline-none focus:text-fg"
          placeholder={path === '' ? 'Loading…' : path}
          spellCheck={false}
          aria-label={`${side === 'remote' ? 'Remote' : 'Local'} path`}
          disabled={!submittable}
        />
      </form>
    </div>
  )
}

function iconFor(entry: SftpEntry): LucideIcon {
  if (entry.kind === 'dir') return FolderClosed
  if (entry.kind === 'symlink') return LinkIcon
  if (entry.name === '..') return FolderUp
  return FileIcon
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}
