import { cn } from '@/lib/cn'

/**
 * Trominal wordmark used in the auth-screen headers. The block square keeps
 * the name visually anchored at any size and matches the design reference.
 */
export function Logo({ className, size = 14 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 font-mono font-semibold tracking-tight text-fg',
        className,
      )}
      style={{ fontSize: size }}
    >
      <span
        aria-hidden
        className="block rounded-[2px] bg-accent"
        style={{ width: size, height: size }}
      />
      trominal
    </span>
  )
}
