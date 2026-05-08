import { Folder, Loader2, Monitor, Plus, Search, Server, Tag, Terminal, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { cn } from '@/lib/cn'
import {
  useDeleteHost,
  useGroups,
  useHosts,
  useSaveGroup,
  useSaveHost,
} from '@/features/vault/hooks'
import { tagsFromInput, type HostInput, type HostItem } from '@/features/vault/model'

const EMPTY_HOST: HostInput = {
  groupId: null,
  name: '',
  hostname: '',
  port: '22',
  username: '',
  tags: [],
  color: '#7dd3a0',
}

function hostToInput(host: HostItem): HostInput {
  return {
    id: host.id,
    groupId: host.groupId,
    name: host.name,
    hostname: host.hostname,
    port: host.port,
    username: host.username,
    tags: host.tags,
    color: host.color || '#7dd3a0',
  }
}

export function HostsPage() {
  const hostsQuery = useHosts()
  const groupsQuery = useGroups()
  const saveHost = useSaveHost()
  const deleteHost = useDeleteHost()
  const saveGroup = useSaveGroup()
  const hosts = hostsQuery.data ?? []
  const groups = groupsQuery.data ?? []
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<string | null>(null)
  const [draft, setDraft] = useState<HostInput>(EMPTY_HOST)
  const [groupName, setGroupName] = useState('')

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

  async function submitHost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await saveHost.mutateAsync(draft)
    setDraft(EMPTY_HOST)
  }

  async function submitGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (groupName.trim() === '') {
      return
    }
    await saveGroup.mutateAsync({
      name: groupName.trim(),
      color: '#7aa2f7',
      parentId: null,
      sortOrder: groups.length,
    })
    setGroupName('')
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[260px_1fr_360px] bg-bg">
      <aside className="flex min-h-0 flex-col border-r border-border bg-bg-elev">
        <div className="border-b border-border p-3">
          <div className="flex h-8 items-center gap-2 rounded-md border border-border-strong bg-surface px-2.5">
            <Search size={13} className="text-fg-faint" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search hosts"
              className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-fg-faint"
            />
          </div>
        </div>

        <div className="border-b border-border-subtle p-3">
          <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wide text-fg-faint">
            <span>Groups</span>
            <button type="button" onClick={() => setGroupFilter(null)} className="text-accent">
              All
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {groups.map((group) => (
              <button
                type="button"
                key={group.id}
                onClick={() => setGroupFilter(group.id)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px]',
                  groupFilter === group.id
                    ? 'bg-surface-3 text-fg'
                    : 'text-fg-muted hover:bg-surface-2',
                )}
              >
                <Folder size={13} style={{ color: group.color || '#7aa2f7' }} />
                <span className="min-w-0 flex-1 truncate">{group.name}</span>
                <span className="font-mono text-[10px] text-fg-faint">
                  {hosts.filter((host) => host.groupId === group.id).length}
                </span>
              </button>
            ))}
          </div>
          <form onSubmit={(event) => void submitGroup(event)} className="mt-3 flex gap-2">
            <input
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="New group"
              className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-[12px] outline-none focus:border-accent"
            />
            <Button size="sm" variant="outline" aria-label="Create group">
              <Plus size={13} />
            </Button>
          </form>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-2">
          {hostsQuery.isLoading ? (
            <div className="flex items-center gap-2 px-2 py-3 text-[12px] text-fg-faint">
              <Loader2 size={13} className="animate-spin" />
              Loading vault
            </div>
          ) : visibleHosts.length === 0 ? (
            <div className="px-2 py-3 text-[12px] text-fg-faint">No hosts match this view.</div>
          ) : (
            visibleHosts.map((host) => (
              <button
                key={host.id}
                type="button"
                onClick={() => setDraft(hostToInput(host))}
                className={cn(
                  'mb-1 w-full rounded-md border-l-2 px-2 py-2 text-left',
                  selected?.id === host.id
                    ? 'border-accent bg-surface-3'
                    : 'border-transparent hover:bg-surface-2',
                )}
              >
                <div className="flex items-center gap-2">
                  <Server size={13} style={{ color: host.color || '#7dd3a0' }} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">
                    {host.name || host.hostname}
                  </span>
                </div>
                <div className="mt-1 truncate pl-5 font-mono text-[11px] text-fg-faint">
                  {host.username ? `${host.username}@` : ''}
                  {host.hostname}:{host.port || '22'}
                </div>
                {host.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1 pl-5">
                    {host.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-sm border border-border-subtle bg-surface px-1.5 py-0.5 font-mono text-[10px] text-fg-muted"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col">
        <div className="flex h-11 items-center gap-3 border-b border-border px-4">
          <Monitor size={15} className="text-accent" />
          <div className="font-medium">{selected?.name ?? 'New host'}</div>
          <div className="font-mono text-[11px] text-fg-faint">
            {selected === null ? 'client-side encrypted create flow' : selected.hostname}
          </div>
          <div className="ml-auto flex gap-2">
            {selected !== null && (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/terminal?host=${selected.id}`}>
                  <Terminal size={13} />
                  Connect
                </Link>
              </Button>
            )}
            <Button size="sm" onClick={() => setDraft(EMPTY_HOST)}>
              <Plus size={13} />
              New
            </Button>
          </div>
        </div>

        <form onSubmit={(event) => void submitHost(event)} className="grid max-w-3xl gap-4 p-5">
          <div className="grid grid-cols-2 gap-4">
            <TextInput
              label="Label"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="web-01.prod"
              required
            />
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
              mono
            />
            <TextInput
              label="Username"
              value={draft.username}
              onChange={(event) => setDraft({ ...draft, username: event.target.value })}
              placeholder="deploy"
              mono
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-fg-muted">
                Group
              </span>
              <select
                value={draft.groupId ?? ''}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    groupId: event.target.value === '' ? null : event.target.value,
                  })
                }
                className="h-10 rounded-md border border-border-strong bg-surface px-3 text-[13px] outline-none focus:border-accent"
              >
                <option value="">No group</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <TextInput
              label="Color"
              value={draft.color}
              onChange={(event) => setDraft({ ...draft, color: event.target.value })}
              placeholder="#7dd3a0"
              mono
            />
          </div>
          <TextInput
            label="Tags"
            icon={<Tag size={13} />}
            value={draft.tags.join(', ')}
            onChange={(event) => setDraft({ ...draft, tags: tagsFromInput(event.target.value) })}
            placeholder="prod, web, rails"
          />
          <div className="flex gap-2">
            <Button disabled={saveHost.isPending}>
              {saveHost.isPending ? <Loader2 size={13} className="animate-spin" /> : null}
              Save encrypted host
            </Button>
            {draft.id !== undefined && (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void deleteHost.mutateAsync(draft.id ?? '').then(() => setDraft(EMPTY_HOST))
                }
              >
                <Trash2 size={13} />
                Delete
              </Button>
            )}
          </div>
        </form>
      </section>

      <aside className="border-l border-border bg-bg-elev p-4">
        <div className="mb-3 text-[11px] uppercase tracking-wide text-fg-faint">Vault state</div>
        <div className="rounded-md border border-border bg-surface p-3">
          <div className="font-mono text-[12px] text-fg">{hosts.length} hosts</div>
          <div className="mt-1 text-[12px] text-fg-muted">{groups.length} encrypted groups</div>
          <div className="mt-3 text-[11px] leading-5 text-fg-faint">
            Host labels, addresses, ports, usernames, tags, and colors are decrypted only after
            unlock and re-encrypted before every API write.
          </div>
        </div>
      </aside>
    </div>
  )
}
