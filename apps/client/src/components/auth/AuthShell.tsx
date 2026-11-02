import { KeyRound, ServerCog, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { Logo } from '@/components/branding/logo'
import { Dot, type DotState } from '@/components/ui/dot'

export type AuthShellProps = {
  title: string
  subtitle?: string
  server?: string
  serverState?: DotState
  width?: number
  children: ReactNode
  footer?: ReactNode
}

const PILLARS: ReadonlyArray<{ icon: typeof ShieldCheck; title: string; body: string }> = [
  {
    icon: ShieldCheck,
    title: 'End-to-end encrypted',
    body: 'Hosts, keys and snippets are encrypted on this device. The server only stores ciphertext.',
  },
  {
    icon: ServerCog,
    title: 'Self-hosted',
    body: 'Your server, your database, your audit log. No third-party cloud in the path.',
  },
  {
    icon: KeyRound,
    title: 'Built for teams',
    body: 'Roles, invites and shared vaults, managed from the admin panel.',
  },
]

/**
 * Auth-screen wrapper. Wide windows get a brand panel on the left and the form on the right;
 * narrow windows show the form alone. Every auth page shares this frame, so the props are the
 * contract: title, subtitle, optional server badge, content and footer.
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
    <div className="grid min-h-full flex-1 bg-bg lg:grid-cols-[minmax(380px,0.9fr)_1.1fr]">
      <aside
        aria-label="About Trominal"
        className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-bg-elev p-10 lg:flex"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(700px 420px at 0% 0%, var(--color-accent-soft), transparent 70%)',
          }}
        />
        <div className="relative">
          <Logo size={16} />
        </div>
        <div className="relative max-w-md">
          <p className="text-[24px] font-semibold leading-tight tracking-tight text-fg">
            The SSH workspace your team can host itself.
          </p>
          <ul className="mt-8 grid gap-5">
            {PILLARS.map((pillar) => (
              <li key={pillar.title} className="flex gap-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-accent">
                  <pillar.icon size={16} aria-hidden />
                </span>
                <div>
                  <div className="text-[13px] font-medium text-fg">{pillar.title}</div>
                  <div className="mt-0.5 text-[12px] leading-relaxed text-fg-muted">
                    {pillar.body}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-[11px] text-fg-faint">Open source · AGPL-3.0</p>
      </aside>

      <main className="flex items-center justify-center px-6 py-10">
        <div className="flex flex-col gap-6" style={{ width, maxWidth: '100%' }}>
          <div className="flex min-h-6 items-center justify-between">
            <span className="lg:invisible">
              <Logo size={15} />
            </span>
            {server !== undefined && (
              <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 font-mono text-[11px] text-fg-muted">
                <Dot state={serverState} size={6} />
                {server}
              </div>
            )}
          </div>

          <header>
            <h1 className="m-0 text-[22px] font-semibold tracking-tight text-fg">{title}</h1>
            {subtitle !== undefined && (
              <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{subtitle}</p>
            )}
          </header>

          <div className="flex flex-col gap-3.5">{children}</div>

          {footer !== undefined && (
            <div className="border-t border-border pt-4 text-[12px] text-fg-muted">{footer}</div>
          )}
        </div>
      </main>
    </div>
  )
}
