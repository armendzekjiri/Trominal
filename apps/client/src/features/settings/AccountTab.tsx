import { useState } from 'react'
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck, ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { getApiClient } from '@/lib/api-client'
import { useAuth } from '@/stores/auth'
import { useVault } from '@/stores/vault'
import { secureStorage } from '@/lib/secure-storage'
import {
  decryptAiSettings,
  decryptGroup,
  decryptHost,
  decryptHostCredential,
  decryptIdentity,
  decryptSnippet,
  decryptTunnel,
  encryptAiSettingsInput,
  encryptGroupInput,
  encryptHostCredentialInput,
  encryptHostInput,
  encryptIdentityInput,
  encryptSnippetInput,
  encryptTunnelInput,
} from '@/features/vault/model'
import {
  DEFAULT_KDF_PARAMS,
  deriveVaultKey,
  generateSalt,
  toBase64,
  wipe,
  type KdfParams,
} from '@trominal/crypto'
import type {
  MasterPasswordChangeItem,
  MasterPasswordChangeRequest,
  VaultRecord,
  VaultRecordPayload,
  VaultResourceType,
} from '@trominal/api-client'

type Status =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'ok'; message: string }
  | { kind: 'error'; message: string }

const RESOURCE_TYPES: ReadonlyArray<VaultResourceType> = [
  'groups',
  'hosts',
  'host-credentials',
  'snippets',
  'identities',
  'tunnels',
  'ai-settings',
]

export function AccountTab() {
  const user = useAuth((s) => s.user)
  const refreshToken = useAuth((s) => s.refreshToken)
  const fetchMe = useAuth((s) => s.fetchMe)
  const vaultKey = useVault((s) => s.key)
  const setMaterial = useVault((s) => s.setMaterial)
  const adoptKey = useVault((s) => s.adoptKey)

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-[18px] font-semibold">Account</h1>
        <p className="mt-1 text-[12px] text-fg-muted">
          Identity, second factor, and vault rotation.
        </p>
      </header>

      {user !== null && (
        <section className="rounded-md border border-border bg-surface p-4 text-[12px]">
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-accent-soft p-2 text-accent">
              <ShieldCheck size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-wide text-fg-faint">Signed in as</div>
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
        currentVaultKey={vaultKey}
        userEmail={user?.email ?? null}
        refreshToken={refreshToken}
        onRotated={(newKey) => {
          // After rotation the in-memory key changes too; adopt it so the
          // user keeps working without re-entering anything.
          adoptKey(newKey)
          if (user !== null) {
            // Pull the fresh vault material from the server (kdf_salt + params changed).
            void fetchMe().then(() => {
              const next = useAuth.getState().user
              if (next !== null) setMaterial(next.vault, useVault.getState().vaultVersion + 1)
            })
          }
        }}
      />
    </div>
  )
}

function TwoFactorSection({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [showSetup, setShowSetup] = useState(false)
  const [setupSecret, setSetupSecret] = useState<string | null>(null)
  const [otp, setOtp] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmCode, setConfirmCode] = useState('')

  async function startSetup(): Promise<void> {
    setStatus({ kind: 'busy' })
    try {
      const api = await getApiClient()
      const response = await api.enableTwoFactor()
      setSetupSecret(response.secret)
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
    <section className="rounded-md border border-border bg-surface p-4">
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
          <div className="rounded-md border border-border-strong bg-surface-2 px-3 py-2 font-mono text-[11px] text-fg-muted">
            Add this to your authenticator: <span className="text-fg">{setupSecret}</span>
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
  currentVaultKey,
  userEmail,
  refreshToken,
  onRotated,
}: {
  currentVaultKey: Uint8Array | null
  userEmail: string | null
  refreshToken: string | null
  onRotated: (newVaultKey: Uint8Array) => void
}) {
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  async function rotate(): Promise<void> {
    if (currentVaultKey === null) {
      setStatus({ kind: 'error', message: 'Vault is locked.' })
      return
    }
    if (userEmail === null) {
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
    const tokenForRequest = refreshToken ?? (await secureStorage.get('refresh_token'))
    if (tokenForRequest === null || tokenForRequest === '') {
      setStatus({
        kind: 'error',
        message: 'Refresh token unavailable - sign out and back in, then try again.',
      })
      return
    }

    setStatus({ kind: 'busy' })
    let newVaultKey: Uint8Array | null = null
    try {
      const params: KdfParams = DEFAULT_KDF_PARAMS
      const newSalt = await generateSalt(params.salt_len)
      newVaultKey = await deriveVaultKey(next, newSalt, params)

      const api = await getApiClient()
      const items: MasterPasswordChangeItem[] = []
      for (const type of RESOURCE_TYPES) {
        const records = await api.listVaultRecords(type)
        for (const record of records) {
          const fields = await reEncryptRecord(type, record, currentVaultKey, newVaultKey)
          if (fields !== null) {
            items.push({ type, id: record.id, fields })
          }
        }
      }

      const payload: MasterPasswordChangeRequest = {
        new_kdf_salt: await toBase64(newSalt),
        new_kdf_params: params as unknown as Record<string, unknown>,
        current_refresh_token: tokenForRequest,
        items,
      }
      await api.changeMasterPassword(payload)
      onRotated(newVaultKey)
      setNext('')
      setConfirm('')
      setStatus({
        kind: 'ok',
        message: `Re-encrypted ${items.length} vault item${items.length === 1 ? '' : 's'}.`,
      })
    } catch (err) {
      if (newVaultKey !== null) wipe(newVaultKey)
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Master password change failed.',
      })
    }
  }

  return (
    <section className="rounded-md border border-border bg-surface p-4">
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
          label="New master password"
          type={show ? 'text' : 'password'}
          mono
          value={next}
          onChange={(event) => setNext(event.target.value)}
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
          label="Confirm new master password"
          type={show ? 'text' : 'password'}
          mono
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
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

/**
 * Re-encrypt every encrypted field of a vault record under a new key.
 * Decryption uses the *current* key + the existing AD; encryption uses the
 * *new* key with the same AD. Only ciphertext+nonce columns are returned;
 * the master-password endpoint rejects any other field name.
 */
async function reEncryptRecord(
  type: VaultResourceType,
  record: VaultRecord,
  currentKey: Uint8Array,
  newKey: Uint8Array,
): Promise<VaultRecordPayload | null> {
  switch (type) {
    case 'groups': {
      const item = await decryptGroup(record, currentKey)
      const payload = await encryptGroupInput(item.id, newKey, {
        id: item.id,
        parentId: item.parentId,
        name: item.name,
        color: item.color,
        sortOrder: item.sortOrder,
      })
      return cipherFields(payload)
    }
    case 'hosts': {
      const item = await decryptHost(record, currentKey)
      const payload = await encryptHostInput(item.id, newKey, {
        id: item.id,
        groupId: item.groupId,
        name: item.name,
        hostname: item.hostname,
        port: item.port,
        username: item.username,
        tags: item.tags,
        color: item.color,
      })
      return cipherFields(payload)
    }
    case 'host-credentials': {
      const item = await decryptHostCredential(record, currentKey)
      const payload = await encryptHostCredentialInput(item.id, newKey, {
        id: item.id,
        hostId: item.hostId,
        identityId: item.identityId,
        label: item.label,
        username: item.username,
        password: item.password,
        privateKeyPassphrase: item.privateKeyPassphrase,
      })
      return cipherFields(payload)
    }
    case 'snippets': {
      const item = await decryptSnippet(record, currentKey)
      const payload = await encryptSnippetInput(item.id, newKey, {
        id: item.id,
        title: item.title,
        body: item.body,
        tags: item.tags,
      })
      return cipherFields(payload)
    }
    case 'identities': {
      const item = await decryptIdentity(record, currentKey)
      const payload = await encryptIdentityInput(item.id, newKey, {
        id: item.id,
        name: item.name,
        keyType: item.keyType,
        publicKey: item.publicKey,
        privateKey: item.privateKey,
      })
      return cipherFields(payload)
    }
    case 'tunnels': {
      const item = await decryptTunnel(record, currentKey)
      const payload = await encryptTunnelInput(item.id, newKey, {
        id: item.id,
        hostId: item.hostId,
        name: item.name,
        config: item.config,
        enabled: item.enabled,
      })
      return cipherFields(payload)
    }
    case 'ai-settings': {
      const item = await decryptAiSettings(record, currentKey)
      const payload = await encryptAiSettingsInput(item.id, newKey, {
        id: item.id,
        provider: item.provider,
        endpoint: item.endpoint,
        model: item.model,
        apiKey: item.apiKey,
        features: item.features,
      })
      return cipherFields(payload)
    }
    default:
      return null
  }
}

/**
 * Strip the relation columns (id, parent_id, etc.) from an encrypt payload.
 * The master-password endpoint only accepts *_ciphertext / *_nonce; all
 * other keys would trip the controller's allowlist check.
 */
function cipherFields(payload: VaultRecordPayload): VaultRecordPayload {
  const out: VaultRecordPayload = {}
  for (const [key, value] of Object.entries(payload)) {
    if (key.endsWith('_ciphertext') || key.endsWith('_nonce')) {
      out[key] = value
    }
  }
  return out
}
