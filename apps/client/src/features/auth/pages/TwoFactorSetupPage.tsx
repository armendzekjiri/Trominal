import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthShell } from '@/components/auth/AuthShell'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { getApiClient } from '@/lib/api-client'
import { useAuth } from '@/stores/auth'
import { useServerDisplay } from '@/features/auth/server-display'
import type { TwoFactorEnableResponse } from '@trominal/api-client'
import { TrominalApiError } from '@trominal/api-client'

type SetupState =
  | { kind: 'loading' }
  | { kind: 'ready'; secret: TwoFactorEnableResponse }
  | { kind: 'verifying' }
  | { kind: 'enabled' }
  | { kind: 'error'; message: string }

export function TwoFactorSetupPage() {
  const navigate = useNavigate()
  const server = useServerDisplay()
  const fetchMe = useAuth((s) => s.fetchMe)
  const userTwoFactor = useAuth((s) => s.user?.two_factor_enabled)

  const [state, setState] = useState<SetupState>({ kind: 'loading' })
  const [code, setCode] = useState('')

  useEffect(() => {
    let active = true
    async function init(): Promise<void> {
      if (userTwoFactor === true) {
        setState({ kind: 'enabled' })
        return
      }
      try {
        const api = await getApiClient()
        const secret = await api.enableTwoFactor()
        if (!active) return
        setState({ kind: 'ready', secret })
      } catch (err) {
        if (!active) return
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Could not start 2FA setup.',
        })
      }
    }
    void init()
    return () => {
      active = false
    }
  }, [userTwoFactor])

  const verify = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (state.kind !== 'ready') return
    setState({ kind: 'verifying' })
    try {
      const api = await getApiClient()
      await api.verifyTwoFactor({ code })
      await fetchMe()
      setState({ kind: 'enabled' })
    } catch (err) {
      const fallback = state.secret
      const message =
        err instanceof TrominalApiError && err.status === 422
          ? 'That code is invalid. Try the next one.'
          : err instanceof Error
            ? err.message
            : 'Could not verify the code.'
      setState({ kind: 'ready', secret: fallback })
      setCode('')
      // surface the error in a banner via state.kind=error briefly? Keep simple.
      setTimeout(() => setState({ kind: 'error', message }), 0)
    }
  }

  return (
    <AuthShell
      title="Set up two-factor"
      subtitle="Scan the QR code (or enter the secret) with an authenticator app, then confirm with a 6-digit code."
      server={server}
      footer={
        <button
          type="button"
          onClick={() => navigate('/unlock')}
          className="text-accent hover:underline"
        >
          Skip for now →
        </button>
      }
    >
      {state.kind === 'loading' && <p className="text-[12px] text-fg-faint">Generating secret…</p>}

      {(state.kind === 'ready' || state.kind === 'verifying' || state.kind === 'error') && (
        <form onSubmit={verify} className="flex flex-col gap-3.5">
          <SecretBlock secret={'secret' in state ? state.secret : null} />
          <TextInput
            label="6-digit code"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            mono
            autoFocus
          />
          {state.kind === 'error' && (
            <div className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-[12px] text-fg">
              {state.message}
            </div>
          )}
          <Button
            type="submit"
            variant="primary"
            full
            size="lg"
            disabled={code.length !== 6 || state.kind === 'verifying'}
          >
            {state.kind === 'verifying' ? 'Verifying…' : 'Enable two-factor'}
          </Button>
        </form>
      )}

      {state.kind === 'enabled' && (
        <div className="flex flex-col gap-3.5">
          <div className="rounded-md border border-accent-ring bg-accent-soft px-3 py-2 text-[12px] text-fg">
            Two-factor authentication is enabled.
          </div>
          <Button
            type="button"
            variant="primary"
            full
            size="lg"
            onClick={() => navigate('/unlock')}
          >
            Continue
          </Button>
        </div>
      )}
    </AuthShell>
  )
}

function SecretBlock({ secret }: { secret: TwoFactorEnableResponse | null }) {
  if (secret === null) return null
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border-strong bg-surface px-3 py-2.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-fg-muted">Secret</span>
      <code className="break-all font-mono text-[12px] text-fg">{secret.secret}</code>
      <span className="mt-1 text-[11px] text-fg-faint">
        Or scan: <span className="break-all font-mono">{secret.otpauth_uri}</span>
      </span>
    </div>
  )
}
