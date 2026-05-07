import type { ReactNode } from 'react'
import { Logo } from '@/components/branding/logo'
import { Dot, type DotState } from '@/components/ui/dot'
import { cn } from '@/lib/cn'

export type AuthShellProps = {
  title: string
  subtitle?: string
  server?: string
  serverState?: DotState
  width?: number
  children: ReactNode
  footer?: ReactNode
}

/**
 * Auth-screen wrapper matching `.ai/design/screens-auth.jsx` (radial accent
 * gradient on the dark canvas, logo top-left, optional server badge top-right,
 * title + subtitle, content slot, divider footer).
 */
export function AuthShell({
  title,
  subtitle,
  server,
  serverState = 'connected',
  width = 380,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div
      className="flex min-h-full flex-1 items-center justify-center px-6 py-8"
      style={{
        background:
          'radial-gradient(1200px 600px at 50% -10%, rgba(125,211,160,0.05), transparent 60%), var(--color-bg)',
      }}
    >
      <div className="flex flex-col gap-5" style={{ width }}>
        <div className="flex items-center justify-between">
          <Logo size={15} />
          {server !== undefined && (
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-fg-faint">
              <Dot state={serverState} size={6} />
              {server}
            </div>
          )}
        </div>

        <header>
          <h1 className="m-0 text-[22px] font-semibold tracking-tight text-fg">{title}</h1>
          {subtitle !== undefined && (
            <p className={cn('mt-1.5 text-[13px] leading-relaxed text-fg-muted')}>{subtitle}</p>
          )}
        </header>

        <div className="flex flex-col gap-3.5">{children}</div>

        {footer !== undefined && (
          <div className="border-t border-border pt-3.5 text-[12px] text-fg-faint">{footer}</div>
        )}
      </div>
    </div>
  )
}
