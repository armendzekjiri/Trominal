import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { useAuth } from '@/stores/auth'
import { useVault } from '@/stores/vault'
import { useServerDisplay } from '@/features/auth/server-display'
import { TrominalApiError } from '@trominal/api-client'

type LaravelValidationBody = {
  message?: string
  errors?: Record<string, string[]>
}

/**
 * Decide what kind of 422 the server returned.
 *
 * - `two_factor_required`: the user has TOTP enabled and we sent no code, so
 *   the server is asking us to challenge them. We swap the form into 2FA
 *   mode and resubmit with the same credentials + code.
 * - `invalid_credentials`: anything else with field-level errors.
 */
function classifyLoginError(err: TrominalApiError): {
  kind: 'two_factor_required' | 'invalid_credentials'
  message: string
} {
  const body = err.json<LaravelValidationBody>()
  const fields = Object.keys(body?.errors ?? {})
  if (fields.includes('two_factor_code')) {
    return {
      kind: 'two_factor_required',
      message:
        body?.errors?.two_factor_code?.[0] ?? 'Enter the 6-digit code from your authenticator app.',
    }
  }
  return {
    kind: 'invalid_credentials',
    message: body?.message ?? 'Invalid email or password.',
  }
}

export function LoginPage() {
  const navigate = useNavigate()
  const server = useServerDisplay()
  const login = useAuth((s) => s.login)
  const setMaterial = useVault((s) => s.setMaterial)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [twoFactorRequired, setTwoFactorRequired] = useState(false)
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  /** Send the credentials, optionally with a TOTP code if we're on the 2FA step. */
  const attemptLogin = async (): Promise<void> => {
    const user = await login({
      email,
      password,
      two_factor_code: twoFactorRequired ? twoFactorCode : undefined,
    })
    setMaterial(user.vault)
    navigate('/unlock')
  }

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await attemptLogin()
    } catch (err) {
      if (err instanceof TrominalApiError && err.status === 422) {
        const verdict = classifyLoginError(err)
        if (verdict.kind === 'two_factor_required' && !twoFactorRequired) {
          // First failure with 2FA-required → switch into 2FA mode but
          // suppress the error banner; the dedicated TextInput tells the
          // user what we need.
          setTwoFactorRequired(true)
          setError(null)
        } else {
          setError(verdict.message)
        }
      } else {
        setError(err instanceof Error ? err.message : 'Sign in failed.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  /** Cancel 2FA mode and let the user re-enter credentials. */
  const cancelTwoFactor = (): void => {
    setTwoFactorRequired(false)
    setTwoFactorCode('')
    setError(null)
  }

  return (
    <AuthShell
      title={twoFactorRequired ? 'Two-factor authentication' : 'Sign in'}
      subtitle={
        twoFactorRequired
          ? 'Enter the 6-digit code from your authenticator app to finish signing in.'
          : 'Welcome back.'
      }
      server={server}
      footer={
        twoFactorRequired ? (
          <button type="button" onClick={cancelTwoFactor} className="text-accent hover:underline">
            ← Use a different account
          </button>
        ) : (
          <Link to="/connect" className="text-accent hover:underline">
            Connect to a different server →
          </Link>
        )
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        {!twoFactorRequired && (
          <>
            <TextInput
              label="Email"
              type="email"
              autoComplete="email"
              icon={<Mail size={14} />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
            <TextInput
              label="Password"
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              icon={<Lock size={14} />}
              suffix={
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="cursor-pointer"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </>
        )}

        {twoFactorRequired && (
          <TextInput
            label="6-digit code"
            inputMode="numeric"
            maxLength={6}
            mono
            value={twoFactorCode}
            onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            autoFocus
            required
            hint={`Signing in as ${email}`}
          />
        )}

        {error !== null && (
          <div className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-[12px] text-fg">
            {error}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          full
          size="lg"
          disabled={submitting || (twoFactorRequired && twoFactorCode.length !== 6)}
        >
          {submitting
            ? twoFactorRequired
              ? 'Verifying…'
              : 'Signing in…'
            : twoFactorRequired
              ? 'Verify and sign in'
              : 'Sign in'}
        </Button>

        {!twoFactorRequired && (
          <div className="text-center text-[12px] text-fg-faint">
            <Link to="/forgot-password" className="text-accent hover:underline">
              Forgot password?
            </Link>
          </div>
        )}
      </form>
    </AuthShell>
  )
}
