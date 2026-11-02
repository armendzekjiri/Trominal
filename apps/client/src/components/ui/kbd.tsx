import { cn } from '@/lib/cn'
import { keyLabels, shortcut, type ShortcutId } from '@/lib/shortcuts'

/** Key caps for a registered shortcut, e.g. <Kbd id="palette" /> → ⌘ K. */
export function Kbd({ id, className }: { id: ShortcutId; className?: string }) {
  const labels = keyLabels(shortcut(id).keys)
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {labels.map((label) => (
        <kbd
          key={label}
          className="inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-border-strong bg-surface-2 px-1 font-sans text-[11px] font-medium leading-none text-fg-muted"
        >
          {label}
        </kbd>
      ))}
    </span>
  )
}
