import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Lock, Mail } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { getApiClient } from '@/lib/api-client'
import { useServerDisplay } from '@/features/auth/server-display'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const server = useServerDisplay()
  const [params] = useSearchParams()

  const [email, setEmail] = useState(() => params.get('email') ?? '')
  const [token, setToken] = useState(() => params.get('token') ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 12) {
      setError('Password must be at least 12 characters.')
      return
    }
    setSubmitting(true)
    try {
      const api = await getApiClient()
      await api.resetPassword({
        email,
        token,
        password,
        password_confirmation: confirm,
      })
      navigate('/login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Choose a new login password"
      subtitle="Use the token from the email we sent."
      server={server}
      footer={
        <Link to="/login" className="text-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <TextInput
          label="Email"
          type="email"
          icon={<Mail size={14} />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextInput
          label="Reset token"
          mono
          value={token}
          onChange={(e) => setToken(e.target.value)}
          required
        />
        <TextInput
          label="New login password"
          type="password"
          autoComplete="new-password"
          icon={<Lock size={14} />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <TextInput
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          icon={<Lock size={14} />}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        {error !== null && (
          <div className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-[12px] text-fg">
            {error}
          </div>
        )}
        <Button type="submit" variant="primary" full size="lg" disabled={submitting}>
          {submitting ? 'Resetting…' : 'Reset password'}
        </Button>
      </form>
    </AuthShell>
  )
}
