import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, RefreshCw, Server } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dot } from '@/components/ui/dot'
import { buildProbeClient } from '@/lib/api-client'
import { getApiBaseUrl } from '@/lib/config'
import type { ServerInfoResponse } from '@trominal/api-client'

type ProbeState =
  | { kind: 'idle' }
  | { kind: 'probing' }
  | { kind: 'ok'; info: ServerInfoResponse; latencyMs: number }
  | { kind: 'error'; message: string }

export function ConnectionTab() {
  const [baseUrl, setBaseUrl] = useState<string | null>(null)
  const [probe, setProbe] = useState<ProbeState>({ kind: 'idle' })

  useEffect(() => {
    let active = true
    void getApiBaseUrl().then((url) => {
      if (active) setBaseUrl(url)
    })
    return () => {
      active = false
    }
  }, [])

  async function check(): Promise<void> {
    if (baseUrl === null || baseUrl === '') return
    setProbe({ kind: 'probing' })
    const start = performance.now()
    try {
      const client = buildProbeClient(baseUrl)
      const info = await client.getServerInfo()
      setProbe({ kind: 'ok', info, latencyMs: Math.round(performance.now() - start) })
    } catch (err) {
      setProbe({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not reach the server.',
      })
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-[18px] font-semibold">Connection</h1>
        <p className="mt-1 text-[12px] text-fg-muted">
          The Trominal server this client talks to. Switching servers signs you out and clears local
          session state.
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-accent-soft p-2 text-accent">
            <Server size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-fg-faint">Current server</div>
            <div className="truncate font-mono text-[13px] text-fg">{baseUrl ?? '-'}</div>
          </div>
          <Link to="/connect" className="text-[12px] text-accent hover:underline">
            Change server
          </Link>
        </div>

        <div className="flex items-center gap-2 border-t border-border-subtle pt-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void check()}
            disabled={baseUrl === null}
          >
            {probe.kind === 'probing' ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <RefreshCw size={13} />
            )}
            Check reachability
          </Button>
          {probe.kind === 'ok' && (
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-accent">
              <Dot state="connected" size={6} />
              {probe.info.instance_name} / {probe.latencyMs} ms
            </span>
          )}
          {probe.kind === 'error' && (
            <span className="truncate font-mono text-[11px] text-danger">{probe.message}</span>
          )}
        </div>
      </section>

      <section className="rounded-md border border-border-subtle bg-surface p-4 text-[12px] text-fg-muted">
        <p>
          Every Trominal client stores its server URL locally and authenticates with a refresh token
          issued by that server. There is no central directory; switching servers is the equivalent
          of switching accounts.
        </p>
      </section>
    </div>
  )
}
