import { cn } from '@/lib/cn'

export type DotState = 'connected' | 'connecting' | 'disconnected' | 'idle'

export type DotProps = {
  state?: DotState
  size?: number
  className?: string
}

/** Tiny status dot shown next to the server URL on auth screens. */
export function Dot({ state = 'idle', size = 6, className }: DotProps) {
  const color =
    state === 'connected'
      ? 'bg-accent'
      : state === 'connecting'
        ? 'bg-warning'
        : state === 'disconnected'
          ? 'bg-danger'
          : 'bg-fg-faint'

  return (
    <span
      className={cn('inline-block rounded-full', color, className)}
      style={{ width: size, height: size }}
      aria-hidden
    />
  )
}
