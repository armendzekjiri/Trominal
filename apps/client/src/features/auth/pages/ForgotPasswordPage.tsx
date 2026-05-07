import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { getApiClient } from '@/lib/api-client'
import { useServerDisplay } from '@/features/auth/server-display'

export function ForgotPasswordPage() {
  const server = useServerDisplay()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const api = await getApiClient()
      await api.forgotPassword({ email })
      setSent(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Reset login password"
      subtitle="If the account exists, we'll email a link to reset your login password. The master password cannot be reset — only changed."
      server={server}
      footer={
        <Link to="/login" className="text-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-md border border-accent-ring bg-accent-soft px-3 py-2.5 text-[12px] text-fg">
          Check your inbox.
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3.5">
          <TextInput
            label="Email"
            type="email"
            autoComplete="email"
            icon={<Mail size={14} />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <Button type="submit" variant="primary" full size="lg" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
