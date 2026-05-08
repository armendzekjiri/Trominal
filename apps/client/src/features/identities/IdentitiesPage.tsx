import { Copy, FileKey2, KeyRound, Loader2, Plus, Trash2, Upload } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { cn } from '@/lib/cn'
import { useDeleteIdentity, useIdentities, useSaveIdentity } from '@/features/vault/hooks'
import { type IdentityInput, type IdentityItem } from '@/features/vault/model'
import {
  ed25519KeyPairToOpenSsh,
  generateEd25519KeyPair,
  rsaPrivateJwkToPem,
  rsaPublicJwkToAuthorizedKey,
} from '@trominal/crypto'

const EMPTY_IDENTITY: IdentityInput = {
  name: '',
  keyType: 'ed25519',
  publicKey: '',
  privateKey: '',
}

function identityToInput(identity: IdentityItem): IdentityInput {
  return {
    id: identity.id,
    name: identity.name,
    keyType: identity.keyType,
    publicKey: identity.publicKey,
    privateKey: identity.privateKey,
  }
}

export function IdentitiesPage() {
  const identitiesQuery = useIdentities()
  const saveIdentity = useSaveIdentity()
  const deleteIdentity = useDeleteIdentity()
  const identities = identitiesQuery.data ?? []
  const [draft, setDraft] = useState<IdentityInput>(EMPTY_IDENTITY)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await saveIdentity.mutateAsync(draft)
  }

  async function generateEd25519(): Promise<void> {
    const keypair = await generateEd25519KeyPair()
    const exported = await ed25519KeyPairToOpenSsh(keypair, draft.name || 'trominal')
    setDraft({
      ...draft,
      keyType: 'ed25519',
      publicKey: exported.publicKey,
      privateKey: exported.privateKey,
    })
    keypair.privateKey.fill(0)
  }

  async function generateRsa(): Promise<void> {
    const pair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    )
    const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
    const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
    setDraft({
      ...draft,
      keyType: 'rsa-4096',
      publicKey: await rsaPublicJwkToAuthorizedKey(publicJwk, draft.name || 'trominal'),
      privateKey: await rsaPrivateJwkToPem(privateJwk),
    })
  }

  async function importPrivateKey(file: File): Promise<void> {
    const privateKey = await file.text()
    setDraft({ ...draft, privateKey, keyType: 'imported' })
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[300px_1fr] bg-bg">
      <aside className="flex min-h-0 flex-col border-r border-border bg-bg-elev">
        <div className="flex items-center justify-between border-b border-border p-3">
          <div>
            <div className="text-[13px] font-medium">Identities</div>
            <div className="font-mono text-[11px] text-fg-faint">{identities.length} encrypted</div>
          </div>
          <Button size="sm" onClick={() => setDraft(EMPTY_IDENTITY)} aria-label="New identity">
            <Plus size={13} />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {identitiesQuery.isLoading ? (
            <div className="flex items-center gap-2 px-2 py-3 text-[12px] text-fg-faint">
              <Loader2 size={13} className="animate-spin" />
              Loading identities
            </div>
          ) : (
            identities.map((identity) => (
              <button
                key={identity.id}
                type="button"
                onClick={() => setDraft(identityToInput(identity))}
                className={cn(
                  'mb-1 w-full rounded-md border-l-2 px-2 py-2 text-left',
                  draft.id === identity.id
                    ? 'border-accent bg-surface-3'
                    : 'border-transparent hover:bg-surface-2',
                )}
              >
                <div className="flex items-center gap-2">
                  <KeyRound size={13} className="text-accent" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                    {identity.name}
                  </span>
                </div>
                <div className="mt-1 pl-5 font-mono text-[11px] text-fg-faint">
                  {identity.keyType}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="min-h-0 overflow-auto p-5">
        <form onSubmit={(event) => void submit(event)} className="grid max-w-4xl gap-4">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <FileKey2 size={16} className="text-accent" />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium">
                {draft.id === undefined ? 'New identity' : draft.name}
              </div>
              <div className="font-mono text-[11px] text-fg-faint">
                Private material is encrypted before storage and never shown in admin.
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void generateEd25519()}
            >
              Generate Ed25519
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void generateRsa()}>
              Generate RSA-4096
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextInput
              label="Name"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="prod deploy key"
              required
            />
            <TextInput
              label="Key type"
              value={draft.keyType}
              onChange={(event) => setDraft({ ...draft, keyType: event.target.value })}
              mono
            />
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-fg-muted">
              Public key
            </span>
            <textarea
              value={draft.publicKey}
              onChange={(event) => setDraft({ ...draft, publicKey: event.target.value })}
              className="min-h-28 resize-y rounded-md border border-border-strong bg-surface p-3 font-mono text-[12px] outline-none focus:border-accent"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-fg-muted">
              Private key
            </span>
            <textarea
              value={draft.privateKey}
              onChange={(event) => setDraft({ ...draft, privateKey: event.target.value })}
              className="min-h-44 resize-y rounded-md border border-border-strong bg-surface p-3 font-mono text-[12px] outline-none focus:border-accent"
              required
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <Button disabled={saveIdentity.isPending}>
              {saveIdentity.isPending ? <Loader2 size={13} className="animate-spin" /> : null}
              Save encrypted identity
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void navigator.clipboard.writeText(draft.publicKey)}
            >
              <Copy size={13} />
              Copy public
            </Button>
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border-strong bg-surface px-3 text-[13px] text-fg-muted hover:bg-surface-2">
              <Upload size={13} />
              Import file
              <input
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file !== undefined) {
                    void importPrivateKey(file)
                  }
                }}
              />
            </label>
            {draft.id !== undefined && (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void deleteIdentity
                    .mutateAsync(draft.id ?? '')
                    .then(() => setDraft(EMPTY_IDENTITY))
                }
              >
                <Trash2 size={13} />
                Delete
              </Button>
            )}
          </div>
        </form>
      </section>
    </div>
  )
}
