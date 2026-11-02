import { useState } from 'react'
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck, ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { QrCode } from '@/components/ui/qr-code'
import { TextInput } from '@/components/ui/text-input'
import { getApiClient } from '@/lib/api-client'
import { useAuth } from '@/stores/auth'
import { useVault } from '@/stores/vault'
import { secureStorage } from '@/lib/secure-storage'
import { rotateMasterPassword, type RotationResult } from '@/features/vault/rotation'
import { TrominalApiError } from '@trominal/api-client'
import type { TwoFactorEnableResponse, UserDto, UserVaultMaterial } from '@trominal/api-client'

type Status =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'ok'; message: string }
  | { kind: 'error'; message: string }

export function AccountTab() {
  const user = useAuth((s) => s.user)
  const refreshToken = useAuth((s) => s.refreshToken)
  const fetchMe = useAuth((s) => s.fetchMe)
  const isUnlocked = useVault((s) => !s.isLocked && s.key !== null)
  const material = useVault((s) => s.material)
  const vaultVersion = useVault((s) => s.vaultVersion)
  const replaceKey = useVault((s) => s.replaceKey)

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-[18px] font-semibold">Account</h1>
        <p className="mt-1 text-[12px] text-fg-muted">
          Identity, second factor, and vault rotation.
        </p>
      </header>

      {user !== null && (
        <section className="rounded-lg border border-border bg-surface p-4 text-[12px]">
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-accent-soft p-2 text-accent">
              <ShieldCheck size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium text-fg-faint">Signed in as</div>
              <div className="truncate font-mono text-[13px] text-fg">{user.email}</div>
            </div>
            <span className="rounded-sm border border-border-subtle bg-surface-2 px-2 py-1 font-mono text-[11px] text-fg-muted">
              {user.roles.join(' / ') || 'user'}
            </span>
          </div>
        </section>
      )}

      <TwoFactorSection
        enabled={user?.two_factor_enabled ?? false}
        onChange={() => void fetchMe()}
      />

      <ChangeMasterPasswordSection
        user={user}
        material={material}
        vaultVersion={vaultVersion}
        isUnlocked={isUnlocked}
        refreshToken={refreshToken}
        onRotated={(result) => {
          // Adopt the new key and the server-confirmed material together (the
          // old key is wiped), so this device keeps working without a re-unlock.
          replaceKey(result.key, result.material, result.vaultVersion)
          void fetchMe()
        }}
      />
    </div>
  )
}

function TwoFactorSection({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [showSetup, setShowSetup] = useState(false)
  const [setupSecret, setSetupSecret] = useState<TwoFactorEnableResponse | null>(null)
  const [otp, setOtp] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmCode, setConfirmCode] = useState('')

  async function startSetup(): Promise<void> {
    setStatus({ kind: 'busy' })
    try {
      const api = await getApiClient()
      const response = await api.enableTwoFactor()
      setSetupSecret(response)
      setShowSetup(true)
      setStatus({ kind: 'idle' })
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not start 2FA setup.',
      })
    }
  }

  async function verifySetup(): Promise<void> {
    if (otp.length !== 6) return
    setStatus({ kind: 'busy' })
    try {
      const api = await getApiClient()
      await api.verifyTwoFactor({ code: otp })
      setShowSetup(false)
      setSetupSecret(null)
      setOtp('')
      setStatus({ kind: 'ok', message: 'Two-factor authentication enabled.' })
      onChange()
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : 'Invalid code.' })
    }
  }

  async function disable(): Promise<void> {
    if (confirmPassword.trim() === '' || confirmCode.length !== 6) return
    setStatus({ kind: 'busy' })
    try {
      const api = await getApiClient()
      await api.disableTwoFactor({ password: confirmPassword, code: confirmCode })
      setConfirmPassword('')
      setConfirmCode('')
      setStatus({ kind: 'ok', message: 'Two-factor authentication disabled.' })
      onChange()
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not disable.',
      })
    }
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <header className="mb-3 flex items-center gap-3">
        <span className="rounded-md bg-accent-soft p-2 text-accent">
          {enabled ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
        </span>
        <div>
          <div className="text-[13px] font-medium text-fg">Two-factor authentication</div>
          <div className="font-mono text-[11px] text-fg-faint">
            {enabled
              ? 'On - required for admin panel + vault export'
              : 'Off - recommended for admin accounts'}
          </div>
        </div>
      </header>

      {!enabled && !showSetup && (
        <Button size="sm" onClick={() => void startSetup()} disabled={status.kind === 'busy'}>
          Enable two-factor
        </Button>
      )}

      {showSetup && setupSecret !== null && (
        <div className="flex flex-col gap-2 border-t border-border-subtle pt-3">
          <div className="flex items-start gap-3 rounded-md border border-border-strong bg-surface-2 p-3">
            <QrCode
              value={setupSecret.otpauth_uri}
              label="QR code for your authenticator app"
              size={136}
            />
            <div className="flex min-w-0 flex-col gap-1 font-mono text-[11px] text-fg-muted">
              <span>Scan with your authenticator app, or enter this secret:</span>
              <span className="break-all text-fg">{setupSecret.secret}</span>
            </div>
          </div>
          <TextInput
            label="6-digit code"
            inputMode="numeric"
            maxLength={6}
            mono
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => void verifySetup()}
              disabled={otp.length !== 6 || status.kind === 'busy'}
            >
              {status.kind === 'busy' ? <Loader2 size={13} className="animate-spin" /> : null}
              Verify
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowSetup(false)
                setSetupSecret(null)
                setOtp('')
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {enabled && (
        <div className="flex flex-col gap-2 border-t border-border-subtle pt-3">
          <TextInput
            label="Login password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          <TextInput
            label="Current 6-digit code"
            inputMode="numeric"
            maxLength={6}
            mono
            value={confirmCode}
            onChange={(event) => setConfirmCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          <Button
            size="sm"
            variant="danger"
            onClick={() => void disable()}
            disabled={confirmPassword === '' || confirmCode.length !== 6 || status.kind === 'busy'}
          >
            Disable two-factor
          </Button>
        </div>
      )}

      {status.kind === 'ok' && <p className="mt-2 text-[12px] text-accent">{status.message}</p>}
      {status.kind === 'error' && <p className="mt-2 text-[12px] text-danger">{status.message}</p>}
    </section>
  )
}

function ChangeMasterPasswordSection({
  user,
  material,
  vaultVersion,
  isUnlocked,
  refreshToken,
  onRotated,
}: {
  user: UserDto | null
  material: UserVaultMaterial | null
  vaultVersion: number
  isUnlocked: boolean
  refreshToken: string | null
  onRotated: (result: RotationResult) => void
}) {
  const [currentMaster, setCurrentMaster] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [show, setShow] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const twoFactorEnabled = user?.two_factor_enabled ?? false

  async function rotate(): Promise<void> {
    if (!isUnlocked || material === null) {
      setStatus({ kind: 'error', message: 'Vault is locked.' })
      return
    }
    if (user === null) {
      setStatus({ kind: 'error', message: 'No active session.' })
      return
    }
    if (next.length < 12) {
      setStatus({ kind: 'error', message: 'Master password must be at least 12 characters.' })
      return
    }
    if (next !== confirm) {
      setStatus({ kind: 'error', message: 'Master passwords do not match.' })
      return
    }
    if (loginPassword === '') {
      setStatus({ kind: 'error', message: 'Enter your login password to confirm.' })
      return
    }
    if (twoFactorEnabled && twoFactorCode.length !== 6) {
      setStatus({ kind: 'error', message: 'Enter the 6-digit code from your authenticator.' })
      return
    }
    const tokenForRequest = refreshToken ?? (await secureStorage.get('refresh_token'))
    if (tokenForRequest === null || tokenForRequest === '') {
      setStatus({
        kind: 'error',
        message: 'Refresh token unavailable - sign out and back in, then try again.',
      })
      return
    }

    setStatus({ kind: 'busy' })
    try {
      const api = await getApiClient()
      const result = await rotateMasterPassword({
        api,
        owner: user,
        material,
        vaultVersion,
        currentMasterPassword: currentMaster,
        newMasterPassword: next,
        currentPassword: loginPassword,
        twoFactorCode: twoFactorEnabled ? twoFactorCode : undefined,
        refreshToken: tokenForRequest,
      })
      onRotated(result)
      setCurrentMaster('')
      setNext('')
      setConfirm('')
      setLoginPassword('')
      setTwoFactorCode('')
      setStatus({
        kind: 'ok',
        message: `Re-encrypted ${result.itemCount} vault item${result.itemCount === 1 ? '' : 's'}. Other devices were signed out.`,
      })
    } catch (err) {
      // The current key stays in place; nothing was changed on the server.
      setStatus({ kind: 'error', message: rotationErrorMessage(err) })
    }
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <header className="mb-3 flex items-center gap-3">
        <span className="rounded-md bg-accent-soft p-2 text-accent">
          <KeyRound size={14} />
        </span>
        <div>
          <div className="text-[13px] font-medium text-fg">Change master password</div>
          <div className="font-mono text-[11px] text-fg-faint">
            Re-encrypts every vault item locally; other devices are signed out.
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-2">
        <TextInput
          label="Current master password"
          type={show ? 'text' : 'password'}
          mono
          autoComplete="current-password"
          value={currentMaster}
          onChange={(event) => setCurrentMaster(event.target.value)}
          suffix={
            <button
              type="button"
              onClick={() => setShow((value) => !value)}
              className="cursor-pointer"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          }
        />
        <TextInput
          label="New master password"
          type={show ? 'text' : 'password'}
          mono
          autoComplete="new-password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
        />
        <TextInput
          label="Confirm new master password"
          type={show ? 'text' : 'password'}
          mono
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
        <TextInput
          label="Login password"
          type="password"
          autoComplete="current-password"
          value={loginPassword}
          onChange={(event) => setLoginPassword(event.target.value)}
        />
        {twoFactorEnabled && (
          <TextInput
            label="Authenticator code"
            inputMode="numeric"
            mono
            maxLength={6}
            value={twoFactorCode}
            onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, ''))}
          />
        )}
        <Button
          size="sm"
          variant="danger"
          onClick={() => void rotate()}
          disabled={status.kind === 'busy'}
        >
          {status.kind === 'busy' ? <Loader2 size={13} className="animate-spin" /> : null}
          Rotate master password
        </Button>
        {status.kind === 'ok' && <p className="text-[12px] text-accent">{status.message}</p>}
        {status.kind === 'error' && <p className="text-[12px] text-danger">{status.message}</p>}
      </div>
    </section>
  )
}

function rotationErrorMessage(err: unknown): string {
  if (err instanceof TrominalApiError) {
    if (err.status === 409) {
      return 'Your vault changed on another device. Nothing was changed; try again.'
    }
    if (err.status === 429) {
      return 'Too many attempts. Wait a while before trying again.'
    }
    const body = err.json<{ message?: string; errors?: Record<string, string[]> }>()
    if (body?.errors !== undefined) {
      return Object.values(body.errors).flat().join(' ')
    }
    return body?.message ?? `Master password change failed (${err.status}).`
  }
  return err instanceof Error ? err.message : 'Master password change failed.'
}
