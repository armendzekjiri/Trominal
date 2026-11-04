import {
  Check,
  KeyRound,
  Loader2,
  Plus,
  Search,
  Server,
  ShieldCheck,
  Tag,
  Terminal,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useVaultActionAccess } from '@/features/vault/access'
import { Kbd } from '@/components/ui/kbd'
import { TextInput } from '@/components/ui/text-input'
import { cn } from '@/lib/cn'
import { formatShortcut, matchesShortcut } from '@/lib/shortcuts'
import { useCommandUi } from '@/features/app/command-ui'
import { isTauri } from '@/lib/platform'
import {
  hostCredentialsForHost,
  latestHostCredentialForHost,
} from '@/features/vault/host-credentials'
import {
  useDeleteHost,
  useDeleteHostCredential,
  useGroups,
  useHostCredentials,
  useHosts,
  useIdentities,
  useSaveGroup,
  useSaveHost,
  useSaveHostCredential,
} from '@/features/vault/hooks'
import {
  tagsFromInput,
  type HostCredentialItem,
  type HostInput,
  type HostItem,
  type IdentityItem,
} from '@/features/vault/model'
import { authForIdentity } from '@/features/vault/ssh-auth'
import { useHostKeyPrompt } from './host-key-prompt'
import { keyTypeLabel, type HostKeyPinPayload } from './host-keys'
import { useHostKeyGate } from './use-host-key-gate'

type TauriCore = {
  invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>
}

type SavedHost = {
  id: string
  name: string
  hostname: string
  port: string
  username: string
}

type BootstrapPrompt = {
  host: SavedHost
  hostKeys: HostKeyPinPayload[]
  identity: IdentityItem
  password: string
  status: 'installing' | 'password'
  error?: string
}

type SshKeyTestResponse = {
  works: boolean
}

const passwordEncoder = new TextEncoder()

const DEFAULT_HOST_COLOR = '#7dd3a0'
const DEFAULT_GROUP_COLOR = '#7aa2f7'

/** Preset host colours; the swatch row offers these, a custom hex still round-trips. */
const HOST_COLORS: ReadonlyArray<{ value: string; name: string }> = [
  { value: '#7dd3a0', name: 'Green' },
  { value: '#7aa2f7', name: 'Blue' },
  { value: '#7dd3c0', name: 'Teal' },
  { value: '#c897e0', name: 'Purple' },
  { value: '#f0a5c4', name: 'Pink' },
  { value: '#f17a7a', name: 'Red' },
  { value: '#e0b870', name: 'Amber' },
  { value: '#a3acb9', name: 'Grey' },
]

/** `#rrggbb` + alpha → rgba(); falls back to the default host colour for anything else. */
function tint(hex: string, alpha: number): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  const value = match?.[1] ?? DEFAULT_HOST_COLOR.slice(1)
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(value.slice(i, i + 2), 16))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function solid(hex: string): string {
  return /^#?[0-9a-f]{6}$/i.test(hex.trim()) ? hex.trim() : DEFAULT_HOST_COLOR
}

type HostDraft = HostInput & {
  credentialId?: string
  identityId: string | null
  /** Raw tags field text; `tags` is parsed from it, so typing a comma isn't swallowed. */
  tagsText: string
}

const EMPTY_HOST: HostDraft = {
  groupId: null,
  name: '',
  hostname: '',
  port: '22',
  username: '',
  tags: [],
  tagsText: '',
  color: DEFAULT_HOST_COLOR,
  identityId: null,
}

function hostToInput(host: HostItem, credential: HostCredentialItem | null): HostDraft {
  return {
    id: host.id,
    groupId: host.groupId,
    name: host.name,
    hostname: host.hostname,
    port: host.port,
    username: host.username,
    tags: host.tags,
    tagsText: host.tags.join(', '),
    color: host.color || DEFAULT_HOST_COLOR,
    credentialId: credential?.id,
    identityId: credential?.identityId ?? null,
  }
}

export function HostsPage() {
  const can = useVaultActionAccess()
  const hostsQuery = useHosts()
  const groupsQuery = useGroups()
  const identitiesQuery = useIdentities()
  const hostCredentialsQuery = useHostCredentials()
  const saveHost = useSaveHost()
  const deleteHost = useDeleteHost()
  const saveHostCredential = useSaveHostCredential()
  const deleteHostCredential = useDeleteHostCredential()
  const saveGroup = useSaveGroup()
  const { ensureHostKeys, handleHostKeyError, verifyFromEditor } = useHostKeyGate()
  const [hostKeyStatus, setHostKeyStatus] = useState<{
    state: 'checking' | 'done' | 'error'
    message: string
  } | null>(null)
  const hosts = hostsQuery.data ?? []
  const groups = groupsQuery.data ?? []
  const identities = identitiesQuery.data ?? []
  const hostCredentials = hostCredentialsQuery.data ?? []
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<string | null>(null)
  const [draft, setDraft] = useState<HostDraft>(EMPTY_HOST)
  const [groupName, setGroupName] = useState('')
  const [keyStatus, setKeyStatus] = useState<string | null>(null)
  const [bootstrap, setBootstrap] = useState<BootstrapPrompt | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [addingGroup, setAddingGroup] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const [searchParams, setSearchParams] = useSearchParams()

  function openNewHost(): void {
    if (!can('hosts.create')) return
    setDraft(EMPTY_HOST)
    setEditorOpen(true)
  }

  function closeEditor(): void {
    setEditorOpen(false)
    setDraft(EMPTY_HOST)
    setHostKeyStatus(null)
    if (searchParams.has('new') || searchParams.has('edit')) setSearchParams({}, { replace: true })
  }

  const location = useLocation()
  const [handledNewRequest, setHandledNewRequest] = useState<string | null>(null)

  // Command palette "New host" lands here as /hosts?new=1. Handled once per navigation,
  // during render (React's pattern for deriving state from props/URL).
  if (
    searchParams.get('new') === '1' &&
    handledNewRequest !== location.key &&
    can('hosts.create')
  ) {
    setHandledNewRequest(location.key)
    setDraft(EMPTY_HOST)
    setEditorOpen(true)
  }

  // "Open host editor" from the host-key dialog lands here as /hosts?edit=<id>.
  const editRequest = searchParams.get('edit')
  if (editRequest !== null && handledNewRequest !== location.key) {
    const target = hosts.find((host) => host.id === editRequest)
    if (target !== undefined) {
      setHandledNewRequest(location.key)
      setDraft(hostToInput(target, latestHostCredentialForHost(target.id, hostCredentials)))
      setHostKeyStatus(null)
      setEditorOpen(true)
    }
  }

  // ⌘F / Ctrl+F focuses search, ⌘N / Ctrl+N starts a new host, Esc closes the editor.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (useCommandUi.getState().open !== null) return
      if (useHostKeyPrompt.getState().prompt !== null) return
      if (matchesShortcut(event, 'hosts.search')) {
        event.preventDefault()
        searchRef.current?.focus()
      } else if (matchesShortcut(event, 'hosts.new') && can('hosts.create')) {
        event.preventDefault()
        setDraft(EMPTY_HOST)
        setEditorOpen(true)
      } else if (event.key === 'Escape' && bootstrap === null) {
        setEditorOpen(false)
        setDraft(EMPTY_HOST)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [bootstrap, can])

  const visibleHosts = hosts.filter((host) => {
    const haystack = [host.name, host.hostname, host.username, host.tags.join(' ')]
      .join(' ')
      .toLowerCase()
    return (
      haystack.includes(search.toLowerCase()) &&
      (groupFilter === null || host.groupId === groupFilter)
    )
  })

  const selected =
    draft.id === undefined ? null : (hosts.find((host) => host.id === draft.id) ?? null)

  const selectedCredential =
    selected === null ? null : latestHostCredentialForHost(selected.id, hostCredentials)

  async function submitHost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!can(draft.id === undefined ? 'hosts.create' : 'hosts.update')) return
    setKeyStatus(null)
    setBootstrap(null)
    const host = await saveHost.mutateAsync({
      id: draft.id,
      groupId: draft.groupId,
      name: draft.name,
      hostname: draft.hostname,
      port: draft.port,
      username: draft.username,
      tags: draft.tags,
      color: draft.color,
    })
    const savedHost = savedHostFromDraft(String(host.id), draft)
    const existingCredentials = hostCredentialsForHost(savedHost.id, hostCredentials)

    if (draft.identityId !== null) {
      const credential = await saveHostCredential.mutateAsync({
        id: draft.credentialId ?? existingCredentials[0]?.id,
        hostId: savedHost.id,
        identityId: draft.identityId,
        label: draft.name || draft.hostname,
        username: '',
        password: '',
        privateKeyPassphrase: '',
      })
      const savedCredentialId = String(credential.id)
      await deleteDuplicateHostCredentials(savedHost.id, savedCredentialId)
      setDraft({
        ...draft,
        id: savedHost.id,
        credentialId: savedCredentialId,
      })
      const identity = identities.find((item) => item.id === draft.identityId)
      if (identity !== undefined && isTauri) {
        const hostKeys = await ensureHostKeys({
          id: savedHost.id,
          teamId: null,
          name: savedHost.name,
          hostname: savedHost.hostname,
          port: savedHost.port,
          username: savedHost.username,
          hostKeys: selected?.hostKeys ?? [],
        }).catch((error: unknown) => {
          setKeyStatus(typeof error === 'string' ? error : 'Could not read the host key.')
          return undefined
        })
        if (hostKeys === undefined) return
        if (hostKeys === null) {
          setKeyStatus('Host key not approved, so the attached SSH key was not tested.')
          return
        }
        setKeyStatus('Testing attached SSH key...')
        let works: boolean
        try {
          works = await testAttachedKey(savedHost, identity, hostKeys)
        } catch (error) {
          setKeyStatus(
            handleHostKeyError(error, { ...savedHost, teamId: null, hostKeys: [] })
              ? 'Host key verification failed, so the attached SSH key was not tested.'
              : typeof error === 'string'
                ? error
                : 'Testing the attached SSH key failed.',
          )
          return
        }
        if (works) {
          setKeyStatus('Attached SSH key already works.')
          closeEditor()
          return
        }
        setBootstrap({
          host: savedHost,
          hostKeys,
          identity,
          password: '',
          status: 'password',
        })
        setKeyStatus('Server password is required to install the attached key.')
        return
      }
    } else {
      await deleteSavedHostCredentials(savedHost.id)
    }

    closeEditor()
  }

  async function deleteDuplicateHostCredentials(hostId: string, keepId: string): Promise<void> {
    const credentialIds = hostCredentialsForHost(hostId, hostCredentials)
      .filter((credential) => credential.id !== keepId)
      .map((credential) => credential.id)

    await Promise.all(credentialIds.map((id) => deleteHostCredential.mutateAsync(id)))
  }

  async function deleteSavedHostCredentials(hostId: string): Promise<void> {
    const credentialIds = new Set(
      hostCredentialsForHost(hostId, hostCredentials).map((credential) => credential.id),
    )
    if (draft.credentialId !== undefined) {
      credentialIds.add(draft.credentialId)
    }

    await Promise.all(Array.from(credentialIds).map((id) => deleteHostCredential.mutateAsync(id)))
  }

  async function submitBootstrap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (bootstrap === null || bootstrap.password === '') {
      return
    }

    setBootstrap({ ...bootstrap, status: 'installing', error: undefined })
    setKeyStatus('Installing public key on the server...')
    try {
      await installAttachedKey(
        bootstrap.host,
        bootstrap.identity,
        bootstrap.password,
        bootstrap.hostKeys,
      )
      if (!(await testAttachedKey(bootstrap.host, bootstrap.identity, bootstrap.hostKeys))) {
        throw new Error('Key install finished, but key authentication still failed.')
      }
      setBootstrap(null)
      closeEditor()
      setKeyStatus('Attached SSH key installed and verified.')
    } catch (error) {
      if (handleHostKeyError(error, { ...bootstrap.host, teamId: null, hostKeys: [] })) {
        setBootstrap(null)
        setKeyStatus('Host key verification failed, so the key was not installed.')
        return
      }
      setBootstrap({
        ...bootstrap,
        password: '',
        status: 'password',
        error:
          typeof error === 'string'
            ? error
            : error instanceof Error
              ? error.message
              : 'SSH key install failed.',
      })
      setKeyStatus('SSH key install failed.')
    }
  }

  async function checkHostKey(): Promise<void> {
    if (selected === null) return
    setHostKeyStatus({ state: 'checking', message: 'Reading the server key…' })
    try {
      const result = await verifyFromEditor(selected)
      setHostKeyStatus(
        result === 'match'
          ? { state: 'done', message: 'Server key matches the approved key.' }
          : result === 'approved'
            ? { state: 'done', message: 'Host key approved.' }
            : result === 'replaced'
              ? { state: 'done', message: 'Approved host key replaced.' }
              : { state: 'done', message: 'Nothing changed.' },
      )
    } catch (error) {
      setHostKeyStatus({
        state: 'error',
        message: typeof error === 'string' ? error : 'Could not read the server key.',
      })
    }
  }

  async function submitGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!can('hosts.create')) return
    if (groupName.trim() === '') {
      return
    }
    await saveGroup.mutateAsync({
      name: groupName.trim(),
      color: DEFAULT_GROUP_COLOR,
      parentId: null,
      sortOrder: groups.length,
    })
    setGroupName('')
    setAddingGroup(false)
  }

  const loading = hostsQuery.isLoading || hostCredentialsQuery.isLoading
  const editing = draft.id !== undefined

  return (
    <div className="flex h-full min-h-0 bg-bg">
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-5">
          <h1 className="text-[15px] font-semibold text-fg">Hosts</h1>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-fg-muted">
            {hosts.length}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <label className="flex h-8 w-64 items-center gap-2 rounded-md border border-border-input bg-surface px-2.5 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-ring">
              <Search size={14} className="shrink-0 text-fg-faint" aria-hidden />
              <span className="sr-only">Search hosts</span>
              <input
                ref={searchRef}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search hosts"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-faint"
              />
              <Kbd id="hosts.search" className="hidden sm:inline-flex" />
            </label>
            {can('hosts.create') && (
              <Button
                size="md"
                onClick={openNewHost}
                title={`New host (${formatShortcut('hosts.new')})`}
              >
                <Plus size={14} aria-hidden />
                New host
              </Button>
            )}
          </div>
        </header>

        {keyStatus !== null && (
          <div
            role="status"
            className="flex items-center gap-2 border-b border-border-subtle bg-surface px-5 py-2 text-[12px] text-fg-muted"
          >
            <KeyRound size={13} className="text-accent" aria-hidden />
            <span className="min-w-0 flex-1">{keyStatus}</span>
            <button
              type="button"
              onClick={() => setKeyStatus(null)}
              aria-label="Dismiss"
              className="rounded-md p-1 text-fg-faint hover:bg-surface-2 hover:text-fg"
            >
              <X size={13} aria-hidden />
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto px-5 pb-6 pt-4">
          <div
            className="mb-4 flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Filter by group"
          >
            <GroupChip
              label="All hosts"
              count={hosts.length}
              active={groupFilter === null}
              onClick={() => setGroupFilter(null)}
            />
            {groups.map((group) => (
              <GroupChip
                key={group.id}
                label={group.name}
                color={group.color || DEFAULT_GROUP_COLOR}
                count={hosts.filter((host) => host.groupId === group.id).length}
                active={groupFilter === group.id}
                onClick={() => setGroupFilter(group.id)}
              />
            ))}
            {addingGroup ? (
              <form
                onSubmit={(event) => void submitGroup(event)}
                className="flex items-center gap-1"
              >
                <input
                  autoFocus
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.stopPropagation()
                      setAddingGroup(false)
                      setGroupName('')
                    }
                  }}
                  aria-label="New group name"
                  placeholder="Group name"
                  className="h-7 w-36 rounded-full border border-border-input bg-surface px-3 text-[12px] outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  aria-label="Create group"
                  className="rounded-full p-1.5 text-accent hover:bg-accent-soft"
                >
                  <Check size={13} aria-hidden />
                </button>
              </form>
            ) : can('hosts.create') ? (
              <button
                type="button"
                onClick={() => setAddingGroup(true)}
                className="flex h-7 items-center gap-1.5 rounded-full border border-dashed border-border-strong px-3 text-[12px] text-fg-muted transition-colors hover:border-fg-faint hover:text-fg"
              >
                <Plus size={12} aria-hidden />
                Group
              </button>
            ) : null}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-6 text-[13px] text-fg-muted">
              <Loader2 size={14} className="animate-spin" aria-hidden />
              Decrypting vault…
            </div>
          ) : hosts.length === 0 ? (
            <EmptyHosts onCreate={can('hosts.create') ? openNewHost : undefined} />
          ) : visibleHosts.length === 0 ? (
            <p className="py-6 text-[13px] text-fg-muted">No hosts match this search or group.</p>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
              {visibleHosts.map((host) => (
                <li key={host.id}>
                  <HostCard
                    host={host}
                    hasIdentity={hostCredentials.some(
                      (credential) => credential.hostId === host.id,
                    )}
                    selected={editorOpen && selected?.id === host.id}
                    onSelect={() => {
                      setDraft(
                        hostToInput(host, latestHostCredentialForHost(host.id, hostCredentials)),
                      )
                      setEditorOpen(true)
                    }}
                    onConnect={() => navigate(`/terminal?host=${host.id}`)}
                    canConnect={can('hosts.connect')}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {editorOpen && (
        <aside
          aria-label={editing ? 'Edit host' : 'New host'}
          className="flex w-[380px] shrink-0 flex-col border-l border-border bg-bg-elev"
        >
          <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
            <span
              aria-hidden
              className="flex size-8 items-center justify-center rounded-md"
              style={{ backgroundColor: tint(draft.color, 0.16), color: solid(draft.color) }}
            >
              <Server size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[14px] font-semibold text-fg">
                {editing ? draft.name || draft.hostname || 'Host' : 'New host'}
              </h2>
              <p className="truncate text-[11px] text-fg-faint">
                Encrypted on this device before upload
              </p>
            </div>
            <button
              type="button"
              onClick={closeEditor}
              aria-label="Close editor"
              title="Close (Esc)"
              className="rounded-md p-1.5 text-fg-faint transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <X size={15} aria-hidden />
            </button>
          </div>

          <form
            onSubmit={(event) => void submitHost(event)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-4">
              <TextInput
                label="Label"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="web-01.prod"
                required
                autoFocus={!editing}
              />
              <div className="grid grid-cols-[1fr_88px] gap-3">
                <TextInput
                  label="Hostname"
                  value={draft.hostname}
                  onChange={(event) => setDraft({ ...draft, hostname: event.target.value })}
                  placeholder="10.0.4.21"
                  mono
                  required
                />
                <TextInput
                  label="Port"
                  value={draft.port}
                  onChange={(event) => setDraft({ ...draft, port: event.target.value })}
                  placeholder="22"
                  inputMode="numeric"
                  mono
                />
              </div>
              <TextInput
                label="Username"
                value={draft.username}
                onChange={(event) => setDraft({ ...draft, username: event.target.value })}
                placeholder="deploy"
                mono
              />
              <SelectField
                label="SSH identity"
                value={draft.identityId ?? ''}
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    credentialId: selectedCredential?.id ?? draft.credentialId,
                    identityId: value === '' ? null : value,
                  })
                }
              >
                <option value="">Prompt / local SSH defaults</option>
                {identities.map((identity) => (
                  <option key={identity.id} value={identity.id}>
                    {identity.name || identity.keyType}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Group"
                value={draft.groupId ?? ''}
                onChange={(value) => setDraft({ ...draft, groupId: value === '' ? null : value })}
              >
                <option value="">No group</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </SelectField>
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1.5 text-[12px] font-medium text-fg-muted">Colour</legend>
                <div className="flex flex-wrap gap-2">
                  {HOST_COLORS.map((option) => {
                    const checked = solid(draft.color).toLowerCase() === option.value
                    return (
                      <label
                        key={option.value}
                        title={option.name}
                        className={cn(
                          'flex size-7 cursor-pointer items-center justify-center rounded-full border-2 transition-transform has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-ring',
                          checked ? 'border-fg' : 'border-transparent hover:scale-110',
                        )}
                        style={{ backgroundColor: option.value }}
                      >
                        <input
                          type="radio"
                          name="host-colour"
                          value={option.value}
                          checked={checked}
                          onChange={() => setDraft({ ...draft, color: option.value })}
                          className="sr-only"
                          aria-label={option.name}
                        />
                        {checked && <Check size={13} className="text-accent-fg" aria-hidden />}
                      </label>
                    )
                  })}
                </div>
              </fieldset>
              <TextInput
                label="Tags"
                icon={<Tag size={13} />}
                value={draft.tagsText}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    tagsText: event.target.value,
                    tags: tagsFromInput(event.target.value),
                  })
                }
                placeholder="prod, web, rails"
                hint="Comma separated"
              />
              {editing && selected !== null && (
                <HostKeySection
                  pins={selected.hostKeys}
                  desktop={isTauri}
                  status={hostKeyStatus}
                  onCheck={() => void checkHostKey()}
                />
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2 border-t border-border p-4">
              {can(editing ? 'hosts.update' : 'hosts.create') && (
                <Button type="submit" disabled={saveHost.isPending}>
                  {saveHost.isPending || saveHostCredential.isPending ? (
                    <Loader2 size={13} className="animate-spin" aria-hidden />
                  ) : null}
                  {editing ? 'Save' : 'Create host'}
                </Button>
              )}
              {selected !== null && can('hosts.connect') && (
                <Button variant="outline" asChild>
                  <Link to={`/terminal?host=${selected.id}`}>
                    <Terminal size={13} aria-hidden />
                    Connect
                  </Link>
                </Button>
              )}
              {editing && can('hosts.delete') && (
                <Button
                  type="button"
                  variant="ghost"
                  className="ml-auto text-danger hover:bg-danger-soft"
                  onClick={() => void deleteHost.mutateAsync(draft.id ?? '').then(closeEditor)}
                >
                  <Trash2 size={13} aria-hidden />
                  Delete
                </Button>
              )}
            </div>
          </form>
        </aside>
      )}

      {bootstrap !== null && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-sm">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-key-title"
            onSubmit={(event) => void submitBootstrap(event)}
            className="grid w-full max-w-md gap-4 rounded-lg border border-border-strong bg-bg-elev p-5 shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-md bg-accent-soft text-accent">
                <KeyRound size={16} aria-hidden />
              </span>
              <div className="min-w-0">
                <div id="install-key-title" className="text-[14px] font-semibold">
                  Install attached SSH key
                </div>
                <div className="truncate font-mono text-[11px] text-fg-faint">
                  {bootstrap.host.username ? `${bootstrap.host.username}@` : ''}
                  {bootstrap.host.hostname}:{bootstrap.host.port || '22'}
                </div>
              </div>
            </div>
            <TextInput
              label="Server password"
              type="password"
              value={bootstrap.password}
              disabled={bootstrap.status === 'installing'}
              error={bootstrap.error}
              onChange={(event) =>
                setBootstrap({
                  ...bootstrap,
                  password: event.target.value,
                  error: undefined,
                })
              }
              autoFocus
              required
            />
            <div className="text-[12px] leading-5 text-fg-muted">
              Trominal will try `ssh-copy-id` first. If it is not available on this machine, it
              falls back to the same authorized_keys install command over SSH.
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={bootstrap.status === 'installing'}
                onClick={() => setBootstrap(null)}
              >
                Cancel
              </Button>
              <Button disabled={bootstrap.status === 'installing'}>
                {bootstrap.status === 'installing' ? (
                  <Loader2 size={13} className="animate-spin" aria-hidden />
                ) : null}
                Install key
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function HostKeySection({
  pins,
  desktop,
  status,
  onCheck,
}: {
  pins: HostItem['hostKeys']
  desktop: boolean
  status: { state: 'checking' | 'done' | 'error'; message: string } | null
  onCheck: () => void
}) {
  return (
    <section className="flex flex-col gap-1.5" aria-labelledby="host-key-label">
      <h3 id="host-key-label" className="text-[12px] font-medium text-fg-muted">
        Host key
      </h3>
      {pins.length === 0 ? (
        <p className="text-[12px] leading-5 text-fg-faint">
          Not verified yet — you&apos;ll be asked to approve the fingerprint on first connect.
        </p>
      ) : (
        <ul className="grid gap-1.5">
          {pins.map((pin) => (
            <li
              key={`${pin.keyType} ${pin.publicKey}`}
              className="rounded-md border border-border bg-surface px-3 py-2"
            >
              <div className="text-[11px] font-medium text-fg-muted">
                {keyTypeLabel(pin.keyType)}
              </div>
              <div className="break-all font-mono text-[12px] text-fg">{pin.fingerprint}</div>
            </li>
          ))}
        </ul>
      )}
      {desktop && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCheck}
            disabled={status?.state === 'checking'}
          >
            {status?.state === 'checking' ? (
              <Loader2 size={12} className="animate-spin" aria-hidden />
            ) : (
              <ShieldCheck size={12} aria-hidden />
            )}
            {pins.length === 0 ? 'Verify host key' : 'Check host key'}
          </Button>
          {status !== null && status.state !== 'checking' && (
            <span
              role="status"
              className={cn(
                'text-[12px]',
                status.state === 'error' ? 'text-danger' : 'text-fg-muted',
              )}
            >
              {status.message}
            </span>
          )}
        </div>
      )}
    </section>
  )
}

function GroupChip({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string
  count: number
  color?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex h-7 items-center gap-2 rounded-full border px-3 text-[12px] font-medium transition-colors',
        active
          ? 'border-accent bg-accent-soft text-fg'
          : 'border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg',
      )}
    >
      {color !== undefined && (
        <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: color }} />
      )}
      <span className="max-w-40 truncate">{label}</span>
      <span className="font-mono text-[11px] text-fg-faint">{count}</span>
    </button>
  )
}

function HostCard({
  host,
  hasIdentity,
  selected,
  onSelect,
  onConnect,
  canConnect,
}: {
  host: HostItem
  hasIdentity: boolean
  selected: boolean
  onSelect: () => void
  onConnect: () => void
  canConnect: boolean
}) {
  const color = solid(host.color || DEFAULT_HOST_COLOR)
  const name = host.name || host.hostname
  return (
    <div
      onDoubleClick={canConnect ? onConnect : undefined}
      className={cn(
        'group relative flex items-start gap-3 rounded-lg border bg-surface p-3.5 transition-colors duration-150',
        selected
          ? 'border-accent bg-surface-2'
          : 'border-border hover:border-border-strong hover:bg-surface-2',
      )}
    >
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: tint(color, 0.16), color }}
      >
        <Server size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className="block w-full truncate text-left text-[13px] font-medium text-fg outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-accent-ring"
        >
          {name}
        </button>
        <div className="mt-0.5 truncate font-mono text-[11px] text-fg-muted">
          {host.username ? `${host.username}@` : ''}
          {host.hostname}:{host.port || '22'}
        </div>
        {(hasIdentity || host.tags.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {hasIdentity && (
              <span className="flex items-center gap-1 rounded-sm bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] text-accent">
                <KeyRound size={10} aria-hidden />
                key
              </span>
            )}
            {host.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-sm bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-fg-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      {canConnect && (
        <button
          type="button"
          onClick={onConnect}
          aria-label={`Connect to ${name}`}
          className="absolute inset-y-0 right-0 z-10 flex items-center rounded-r-lg bg-gradient-to-l from-surface-2 from-60% to-transparent pl-10 pr-3 opacity-0 transition-opacity duration-150 focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
        >
          <span className="flex h-7 items-center gap-1.5 rounded-md bg-accent px-2.5 text-[12px] font-medium text-accent-fg hover:bg-accent-hover">
            <Terminal size={12} aria-hidden />
            Connect
          </span>
        </button>
      )}
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-medium text-fg-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-border-input bg-surface px-3 text-[13px] text-fg outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent-ring"
      >
        {children}
      </select>
    </div>
  )
}

function EmptyHosts({ onCreate }: { onCreate?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border-strong px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-lg bg-accent-soft text-accent">
        <Server size={22} aria-hidden />
      </span>
      <div>
        <h2 className="text-[15px] font-semibold text-fg">No hosts yet</h2>
        <p className="mt-1 max-w-sm text-[13px] text-fg-muted">
          Add a server to connect over SSH. Everything about it is encrypted on this device before
          it is synced.
        </p>
      </div>
      {onCreate && (
        <Button onClick={onCreate}>
          <Plus size={14} aria-hidden />
          New host
        </Button>
      )}
    </div>
  )
}

function savedHostFromDraft(id: string, draft: HostDraft): SavedHost {
  return {
    id,
    name: draft.name,
    hostname: draft.hostname,
    port: draft.port || '22',
    username: draft.username,
  }
}

async function testAttachedKey(
  host: SavedHost,
  identity: IdentityItem,
  hostKeys: HostKeyPinPayload[],
): Promise<boolean> {
  const auth = await authForIdentity(identity)
  if (auth.kind !== 'private-key') {
    return false
  }

  try {
    const { invoke } = await tauriCore()
    const response = await invoke<SshKeyTestResponse>('ssh_key_test', {
      request: {
        host: host.hostname,
        port: sshPort(host.port),
        username: host.username,
        privateKeyPem: Array.from(auth.privateKeyPem),
        hostKeys,
      },
    })
    return response.works
  } finally {
    auth.privateKeyPem.fill(0)
  }
}

async function installAttachedKey(
  host: SavedHost,
  identity: IdentityItem,
  password: string,
  hostKeys: HostKeyPinPayload[],
): Promise<void> {
  const auth = await authForIdentity(identity)
  if (auth.kind !== 'private-key') {
    throw new Error('The selected identity is not a private key.')
  }
  if (auth.publicKey === undefined || auth.publicKey === '') {
    auth.privateKeyPem.fill(0)
    throw new Error('The selected identity does not have an authorized_keys public key.')
  }

  const passwordBytes = passwordEncoder.encode(password)
  try {
    auth.privateKeyPem.fill(0)
    const { invoke } = await tauriCore()
    await invoke('ssh_key_install', {
      request: {
        host: host.hostname,
        port: sshPort(host.port),
        username: host.username,
        publicKey: auth.publicKey,
        password: Array.from(passwordBytes),
        hostKeys,
      },
    })
  } finally {
    passwordBytes.fill(0)
  }
}

async function tauriCore(): Promise<TauriCore> {
  return import('@tauri-apps/api/core') as Promise<TauriCore>
}

function sshPort(value: string): number {
  const parsed = Number.parseInt(value || '22', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 22
}
