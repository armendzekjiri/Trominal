import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Server } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { getApiBaseUrl, setApiBaseUrl } from '@/lib/config'
import { openExternal } from '@/lib/open-external'
import { buildProbeClient, resetApiClient } from '@/lib/api-client'
import { parseServerUrl } from '@/lib/server-url'
import { teardownSession } from '@/lib/session-teardown'
import { secureStorage } from '@/lib/secure-storage'
import { useAuth } from '@/stores/auth'
import type { ServerInfoResponse } from '@trominal/api-client'

const SELF_HOSTING_URL = 'https://trominal.app/docs/self-hosting'

type ProbeState =
  | { kind: 'idle' }
  | { kind: 'probing' }
  | { kind: 'ok'; url: string; info: ServerInfoResponse; latencyMs: number }
  | { kind: 'error'; message: string }

export function ConnectPage() {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [probe, setProbe] = useState<ProbeState>({ kind: 'idle' })

  // Pre-fill the server already in use, so "switch server" starts from where you are.
  useEffect(() => {
    let active = true
    void getApiBaseUrl().then((saved) => {
      if (active && saved !== null && saved !== '') setUrl((current) => current || saved)
    })
    return () => {
      active = false
    }
  }, [])

  const handleProbe = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const parsed = parseServerUrl(url)
    if (!parsed.ok) {
      setProbe({ kind: 'error', message: parsed.message })
      return
    }
    const target = parsed.url
    setProbe({ kind: 'probing' })
    const start = performance.now()
    try {
      const client = buildProbeClient(target)
      const info = await client.getServerInfo()
      const latencyMs = Math.round(performance.now() - start)
      setProbe({ kind: 'ok', url: target, info, latencyMs })
    } catch (err) {
      setProbe({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not reach this server.',
      })
    }
  }

  const handleConnect = async (): Promise<void> => {
    if (probe.kind !== 'ok') return
    const previous = await getApiBaseUrl()
    if (previous !== probe.url) {
      // Switching servers: end the old server's session (revoking its tokens
      // there) and wipe everything that belonged to it, so neither its refresh
      // token nor its decrypted data is ever presented to the new server.
      if (useAuth.getState().accessToken !== null) {
        await useAuth.getState().logout()
      } else {
        await secureStorage.delete('refresh_token')
        await teardownSession()
      }
    }
    await setApiBaseUrl(probe.url)
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
            href={SELF_HOSTING_URL}
            onClick={(event) => {
              event.preventDefault()
              void openExternal(SELF_HOSTING_URL)
            }}
            className="text-accent hover:underline"
          >
            Read the self-hosting guide →
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
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-md border border-accent-ring bg-accent-soft px-3 py-2.5 text-[12px]"
          >
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
          <div
            role="alert"
            className="flex items-center gap-2.5 rounded-md border border-danger bg-danger-soft px-3 py-2.5 text-[12px] text-fg"
          >
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
