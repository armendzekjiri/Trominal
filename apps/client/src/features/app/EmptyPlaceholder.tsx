import type { ReactNode } from 'react'

/** Reusable empty-state matching `.ai/design/screens-system.jsx`. */
export function EmptyPlaceholder({
  title,
  body,
  hint,
}: {
  title: string
  body: string
  hint?: ReactNode
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
      <h2 className="text-[18px] font-semibold text-fg">{title}</h2>
      <p className="max-w-sm text-[13px] leading-relaxed text-fg-muted">{body}</p>
      {hint !== undefined && <div className="mt-2 text-[12px] text-fg-faint">{hint}</div>}
    </div>
  )
}
