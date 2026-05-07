import { useState } from 'react'
import { Eye, EyeOff, Key, Shield, Unlock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AuthShell } from '@/components/auth/AuthShell'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { useAuth } from '@/stores/auth'
import { useVault } from '@/stores/vault'
import { useServerDisplay } from '@/features/auth/server-display'

export function UnlockPage() {
  const navigate = useNavigate()
  const baseServer = useServerDisplay()
  const user = useAuth((s) => s.user)
  const fetchMe = useAuth((s) => s.fetchMe)
  const logout = useAuth((s) => s.logout)
  const vaultMaterial = useVault((s) => s.material)
  const setMaterial = useVault((s) => s.setMaterial)
  const unlock = useVault((s) => s.unlock)

  const [masterPw, setMasterPw] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      let activeUser = user
      if (activeUser === null || vaultMaterial === null) {
        activeUser = await fetchMe()
        setMaterial(activeUser.vault)
      }
      if (activeUser === null) {
        throw new Error('Session lost — sign in again.')
      }
      await unlock(masterPw, activeUser.email)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unlock failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const server =
    user !== null && baseServer !== undefined ? `${baseServer} · ${user.email}` : baseServer

  return (
    <AuthShell
      title="Vault locked"
      subtitle="Enter your master password to decrypt your hosts, snippets, and identities."
      server={server}
      footer={
        <span className="inline-flex items-center gap-1.5">
          <Shield size={11} />
          Auto-locks after 15 min of inactivity
        </span>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <TextInput
          label="Master password"
          type={show ? 'text' : 'password'}
          autoComplete="current-password"
          icon={<Key size={14} />}
          mono
          suffix={
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="cursor-pointer"
              aria-label={show ? 'Hide master password' : 'Show master password'}
            >
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          }
          value={masterPw}
          onChange={(e) => setMasterPw(e.target.value)}
          autoFocus
          required
        />
        {error !== null && (
          <div className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-[12px] text-fg">
            {error}
          </div>
        )}
        <Button type="submit" variant="primary" full size="lg" disabled={submitting}>
          <Unlock size={14} />
          {submitting ? 'Unlocking…' : 'Unlock vault'}
        </Button>
        <div className="text-center text-[12px] text-fg-faint">
          Wrong account?{' '}
          <button
            type="button"
            onClick={() => {
              void logout()
            }}
            className="cursor-pointer text-accent hover:underline"
          >
            Sign out
          </button>
        </div>
      </form>
    </AuthShell>
  )
}
