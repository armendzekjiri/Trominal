import { Download, Loader2, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { isTauri } from '@/lib/platform'
import { checkForDesktopUpdate, installDesktopUpdate } from '@/lib/updater'
import type { Update } from '@tauri-apps/plugin-updater'

type UpdateState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'current'; message: string }
  | { kind: 'available'; update: Update }
  | { kind: 'installing'; receivedBytes: number; totalBytes: number | null }
  | { kind: 'installed'; version: string }
  | { kind: 'error'; message: string }

export function AdvancedTab() {
  const [state, setState] = useState<UpdateState>({ kind: 'idle' })

  async function checkUpdates(): Promise<void> {
    setState({ kind: 'checking' })
    try {
      const result = await checkForDesktopUpdate()
      if (result.kind === 'web') {
        setState({
          kind: 'current',
          message: 'Web builds are updated by the self-hosted deployment.',
        })
        return
      }
      if (result.kind === 'current') {
        setState({ kind: 'current', message: 'This desktop build is current.' })
        return
      }
      setState({ kind: 'available', update: result.update })
    } catch (err) {
      setState({
        kind: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Could not check for updates. This build may not be release-configured.',
      })
    }
  }

  async function install(update: Update): Promise<void> {
    setState({ kind: 'installing', receivedBytes: 0, totalBytes: null })
    try {
      await installDesktopUpdate(update, (receivedBytes, totalBytes) => {
        setState({ kind: 'installing', receivedBytes, totalBytes })
      })
      setState({ kind: 'installed', version: update.version })
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not install the update.',
      })
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-[18px] font-semibold">Advanced</h1>
        <p className="mt-1 text-[12px] text-fg-muted">
          Desktop update checks and release-channel diagnostics.
        </p>
      </header>

      <section className="rounded-md border border-border bg-surface p-4">
        <header className="mb-3 flex items-center gap-3">
          <span className="rounded-md bg-accent-soft p-2 text-accent">
            <Sparkles size={14} />
          </span>
          <div>
            <div className="text-[13px] font-medium text-fg">Application updates</div>
            <div className="font-mono text-[11px] text-fg-faint">
              {isTauri ? 'Tauri updater channel' : 'Web deployment channel'}
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-3">
          <div className="rounded-md border border-border-subtle bg-surface-2 p-3 text-[12px] leading-relaxed text-fg-muted">
            Desktop releases verify signed updater artifacts before installing. Web builds update
            when the self-hosted server deploys a new client bundle.
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void checkUpdates()}
              disabled={state.kind === 'checking' || state.kind === 'installing'}
            >
              {state.kind === 'checking' ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <RefreshCw size={13} />
              )}
              Check for updates
            </Button>

            {state.kind === 'available' && (
              <Button size="sm" onClick={() => void install(state.update)}>
                <Download size={13} />
                Install {state.update.version}
              </Button>
            )}
          </div>

          <UpdateStatus state={state} />
        </div>
      </section>
    </div>
  )
}

function UpdateStatus({ state }: { state: UpdateState }) {
  switch (state.kind) {
    case 'idle':
      return (
        <p className="font-mono text-[11px] text-fg-faint">
          No update check has run in this session.
        </p>
      )
    case 'checking':
      return <p className="font-mono text-[11px] text-fg-faint">Checking release channel...</p>
    case 'current':
      return (
        <p className="flex items-center gap-1.5 font-mono text-[11px] text-accent">
          <ShieldCheck size={12} />
          {state.message}
        </p>
      )
    case 'available':
      return (
        <div className="rounded-md border border-accent-ring bg-accent-soft p-3 text-[12px]">
          <div className="font-medium text-fg">Version {state.update.version} is available.</div>
          {state.update.body !== undefined && state.update.body.trim() !== '' ? (
            <p className="mt-1 whitespace-pre-wrap font-mono text-[11px] text-fg-muted">
              {state.update.body}
            </p>
          ) : null}
        </div>
      )
    case 'installing': {
      const progress =
        state.totalBytes === null || state.totalBytes <= 0
          ? null
          : Math.round((state.receivedBytes / state.totalBytes) * 100)
      return (
        <p className="font-mono text-[11px] text-fg-faint">
          Installing update{progress === null ? '...' : `... ${progress}%`}
        </p>
      )
    }
    case 'installed':
      return (
        <p className="flex items-center gap-1.5 font-mono text-[11px] text-accent">
          <ShieldCheck size={12} />
          Version {state.version} installed. Restart Trominal to finish.
        </p>
      )
    case 'error':
      return <p className="font-mono text-[11px] text-danger">{state.message}</p>
  }
}
