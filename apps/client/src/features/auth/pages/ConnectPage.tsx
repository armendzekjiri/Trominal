import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Server } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { setApiBaseUrl } from '@/lib/config'
import { buildProbeClient, resetApiClient } from '@/lib/api-client'
import type { ServerInfoResponse } from '@trominal/api-client'

type ProbeState =
  | { kind: 'idle' }
  | { kind: 'probing' }
  | { kind: 'ok'; info: ServerInfoResponse; latencyMs: number }
  | { kind: 'error'; message: string }

function normaliseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

export function ConnectPage() {
  const navigate = useNavigate()
  const [url, setUrl] = useState('http://localhost:8000')
  const [probe, setProbe] = useState<ProbeState>({ kind: 'idle' })

  const handleProbe = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const target = normaliseUrl(url)
    if (target === '') {
      setProbe({ kind: 'error', message: 'Enter a server URL.' })
      return
    }
    setProbe({ kind: 'probing' })
    const start = performance.now()
    try {
      const client = buildProbeClient(target)
      const info = await client.getServerInfo()
      const latencyMs = Math.round(performance.now() - start)
      setProbe({ kind: 'ok', info, latencyMs })
    } catch (err) {
      setProbe({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not reach this server.',
      })
    }
  }

  const handleConnect = async (): Promise<void> => {
    if (probe.kind !== 'ok') return
    await setApiBaseUrl(normaliseUrl(url))
    resetApiClient()
    if (probe.info.registration_open) {
      navigate('/register')
    } else {
      navigate('/login')
    }
  }

  return (
    <AuthShell
      title="Connect to your Trominal server"
      subtitle="Trominal is self-hosted. Point this client at your server's API URL to get started."
      footer={
        <>
          Don't have a server yet?{' '}
          <a
            href="https://github.com/anthropics/claude-code/issues"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            Read the deploy guide →
          </a>
        </>
      }
    >
      <form onSubmit={handleProbe} className="flex flex-col gap-3.5">
        <TextInput
          label="Server URL"
          mono
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setProbe({ kind: 'idle' })
          }}
          icon={<Server size={14} />}
          placeholder="https://trominal.example.com"
          autoFocus
        />

        {probe.kind === 'ok' && (
          <div className="flex items-center gap-2.5 rounded-md border border-accent-ring bg-accent-soft px-3 py-2.5 text-[12px]">
            <span className="text-accent">✓</span>
            <div className="flex-1">
              <div className="font-medium text-fg">Reachable · {probe.info.instance_name}</div>
              <div className="mt-0.5 font-mono text-[11px] text-fg-muted">
                registration {probe.info.registration_mode}
                {probe.info.registration_open ? ' · open' : ' · closed'} · {probe.latencyMs} ms
              </div>
            </div>
          </div>
        )}
        {probe.kind === 'error' && (
          <div className="flex items-center gap-2.5 rounded-md border border-danger bg-danger-soft px-3 py-2.5 text-[12px] text-fg">
            <span className="text-danger">!</span>
            <span className="flex-1">{probe.message}</span>
          </div>
        )}

        {probe.kind !== 'ok' ? (
          <Button
            type="submit"
            variant="primary"
            full
            size="lg"
            disabled={probe.kind === 'probing'}
          >
            {probe.kind === 'probing' ? 'Checking…' : 'Check server'}
          </Button>
        ) : (
          <Button type="button" variant="primary" full size="lg" onClick={handleConnect}>
            Connect
          </Button>
        )}
      </form>
    </AuthShell>
  )
}
