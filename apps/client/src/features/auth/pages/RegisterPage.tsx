import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Key, Lock, Mail } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { useAuth } from '@/stores/auth'
import { useVault } from '@/stores/vault'
import { useServerDisplay } from '@/features/auth/server-display'
import { TrominalApiError } from '@trominal/api-client'
import {
  DEFAULT_KDF_PARAMS,
  deriveVaultKey,
  encrypt,
  fromBase64,
  generateSalt,
  generateX25519KeyPair,
  makeAd,
  toBase64,
} from '@trominal/crypto'

const MIN_MASTER_LEN = 12

function scoreMaster(pw: string): number {
  // Lightweight strength heuristic — full zxcvbn lands when we ship Settings.
  let score = 0
  if (pw.length >= MIN_MASTER_LEN) score++
  if (pw.length >= 16) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return Math.min(4, score)
}

export function RegisterPage() {
  const navigate = useNavigate()
  const server = useServerDisplay()
  const register = useAuth((s) => s.register)
  const adoptKey = useVault((s) => s.adoptKey)
  const setMaterial = useVault((s) => s.setMaterial)

  const [email, setEmail] = useState('')
  const [loginPw, setLoginPw] = useState('')
  const [masterPw, setMasterPw] = useState('')
  const [masterPwConfirm, setMasterPwConfirm] = useState('')
  const [showMaster, setShowMaster] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const masterScore = useMemo(() => scoreMaster(masterPw), [masterPw])

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)

    if (loginPw.length < MIN_MASTER_LEN) {
      setError('Login password must be at least 12 characters.')
      return
    }
    if (masterPw.length < MIN_MASTER_LEN) {
      setError('Master password must be at least 12 characters.')
      return
    }
    if (masterPw !== masterPwConfirm) {
      setError('Master passwords do not match.')
      return
    }
    if (masterScore < 3) {
      setError('Choose a stronger master password — it cannot be recovered.')
      return
    }
    if (!accepted) {
      setError('You must acknowledge the master-password recovery warning.')
      return
    }

    setSubmitting(true)
    try {
      const params = DEFAULT_KDF_PARAMS
      const saltBytes = await generateSalt(params.salt_len)
      const vaultKey = await deriveVaultKey(masterPw, saltBytes, params)
      const keypair = await generateX25519KeyPair()
      const env = await encrypt(keypair.privateKey, vaultKey, makeAd('user_private_key', email))

      const user = await register({
        email,
        password: loginPw,
        password_confirmation: loginPw,
        kdf_salt: await toBase64(saltBytes),
        kdf_params: params,
        public_key: await toBase64(keypair.publicKey),
        private_key_ciphertext: env.ct,
        private_key_nonce: env.n,
      })

      // Round-trip the salt — server returned the same value, but we keep our
      // own derived key rather than re-deriving from the password.
      await fromBase64(user.vault.kdf_salt)
      setMaterial(user.vault)
      adoptKey(vaultKey)
      navigate('/2fa/setup')
    } catch (err) {
      if (err instanceof TrominalApiError) {
        const body = err.json<{ message?: string; errors?: Record<string, string[]> }>()
        setError(
          body?.errors !== undefined
            ? Object.values(body.errors).flat().join(' ')
            : (body?.message ?? `Sign-up failed (${err.status}).`),
        )
      } else {
        setError(err instanceof Error ? err.message : 'Sign-up failed.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Your master password encrypts everything client-side. We never see it — losing it means losing your vault."
      server={server}
      width={400}
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </>
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
          label="Login password"
          type="password"
          autoComplete="new-password"
          icon={<Lock size={14} />}
          hint="Used to authenticate with the server."
          value={loginPw}
          onChange={(e) => setLoginPw(e.target.value)}
          required
        />

        <div>
          <TextInput
            label="Master password"
            type={showMaster ? 'text' : 'password'}
            autoComplete="new-password"
            icon={<Key size={14} />}
            mono
            suffix={
              <button
                type="button"
                onClick={() => setShowMaster((v) => !v)}
                className="cursor-pointer"
                aria-label={showMaster ? 'Hide master password' : 'Show master password'}
              >
                {showMaster ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            }
            value={masterPw}
            onChange={(e) => setMasterPw(e.target.value)}
            required
          />
          <div className="mt-1.5 flex gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-[3px] flex-1 rounded-full"
                style={{
                  background: i <= masterScore ? 'var(--color-accent)' : 'var(--color-surface-3)',
                }}
              />
            ))}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-fg-faint">
            <span>{strengthLabel(masterScore)}</span>
            <span className="font-mono">{masterPw.length} chars</span>
          </div>
        </div>

        <TextInput
          label="Confirm master password"
          type={showMaster ? 'text' : 'password'}
          autoComplete="new-password"
          icon={<Key size={14} />}
          mono
          value={masterPwConfirm}
          onChange={(e) => setMasterPwConfirm(e.target.value)}
          required
        />

        <label className="flex items-start gap-2.5 text-[12px] leading-relaxed text-fg-muted">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-[3px] h-3.5 w-3.5 accent-[var(--color-accent)]"
          />
          <span>
            I understand the master password cannot be recovered, and I accept the terms of service.
          </span>
        </label>

        {error !== null && (
          <div className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-[12px] text-fg">
            {error}
          </div>
        )}

        <Button type="submit" variant="primary" full size="lg" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  )
}

function strengthLabel(score: number): string {
  switch (score) {
    case 0:
    case 1:
      return 'Too weak'
    case 2:
      return 'Weak'
    case 3:
      return 'Strong'
    default:
      return 'Very strong'
  }
}
