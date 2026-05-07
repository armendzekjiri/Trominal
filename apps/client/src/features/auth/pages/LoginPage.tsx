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

export function LoginPage() {
  const navigate = useNavigate()
  const server = useServerDisplay()
  const login = useAuth((s) => s.login)
  const setMaterial = useVault((s) => s.setMaterial)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const user = await login({ email, password })
      setMaterial(user.vault)
      if (user.two_factor_enabled) {
        // TOTP is enforced server-side for sensitive ops; here we just note
        // it's enabled and proceed straight to vault unlock. A future commit
        // can add a step-up challenge for vault-export / master-pw-change.
      }
      navigate('/unlock')
    } catch (err) {
      if (err instanceof TrominalApiError && err.status === 422) {
        setError('Invalid email or password.')
      } else {
        setError(err instanceof Error ? err.message : 'Sign in failed.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back."
      server={server}
      footer={
        <Link to="/connect" className="text-accent hover:underline">
          Connect to a different server →
        </Link>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-3.5">
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
        {error !== null && (
          <div className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-[12px] text-fg">
            {error}
          </div>
        )}
        <Button type="submit" variant="primary" full size="lg" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
        <div className="text-center text-[12px] text-fg-faint">
          <Link to="/forgot-password" className="text-accent hover:underline">
            Forgot password?
          </Link>
        </div>
      </form>
    </AuthShell>
  )
}
