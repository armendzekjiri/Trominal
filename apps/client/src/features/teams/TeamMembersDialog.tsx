import * as Dialog from '@radix-ui/react-dialog'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Users, X } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { TrominalApiError, type TeamRole } from '@trominal/api-client'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { getApiClient } from '@/lib/api-client'
import { useAuth } from '@/stores/auth'
import { useVault } from '@/stores/vault'
import { teamKeys, type TeamSummary } from './api'
import { inviteMember } from './invite-member'
import { removeMemberWithRotation } from './remove-member'
import { useTeamScope } from './store'

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
})
type FormValues = z.infer<typeof schema>

export function TeamMembersDialog({
  team,
  canAdd,
  canRemove = false,
  canAssignRoles = false,
}: {
  team: TeamSummary
  canAdd: boolean
  canRemove?: boolean
  canAssignRoles?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const userId = useAuth((state) => String(state.user?.id ?? ''))
  const selectedKey = useTeamScope((state) => state.selectedTeamKey)
  const selectedKeyTeamId = useTeamScope((state) => state.selectedTeamKeyTeamId)
  const selectedKeyVersion = useTeamScope((state) => state.selectedTeamKeyVersion)
  const queryKey = ['team-members', userId, team.id] as const
  const members = useQuery({
    queryKey,
    enabled: open && userId !== '',
    gcTime: 0,
    queryFn: async () => (await getApiClient()).listTeamMembers(team.id),
  })
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', role: 'member' },
  })
  const add = useMutation({
    mutationFn: async ({ email, role }: FormValues) => {
      const user = useAuth.getState().user
      const vaultKey = useVault.getState().key
      const scope = useTeamScope.getState()
      const key = scope.selectedTeamKey
      const version = scope.selectedTeamKeyVersion
      if (
        !user ||
        !vaultKey ||
        !key ||
        scope.selectedTeamId !== team.id ||
        scope.selectedTeamKeyTeamId !== team.id ||
        version === null
      ) {
        throw new Error('Unlock this team workspace before adding a member.')
      }
      if (role === 'owner' && team.role !== 'owner')
        throw new Error('Only an owner can add another owner.')
      const isCurrent = () => {
        const current = useTeamScope.getState()
        return (
          useAuth.getState().user?.id === user.id &&
          useVault.getState().key === vaultKey &&
          current.selectedTeamId === team.id &&
          current.selectedTeamKey === key &&
          current.selectedTeamKeyTeamId === team.id &&
          current.selectedTeamKeyVersion === version
        )
      }
      return inviteMember(team.id, version, key, email, role, await getApiClient(), isCurrent)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey })
      form.reset()
    },
    onError: (error) => {
      if (
        error instanceof TrominalApiError &&
        error.status === 409 &&
        useTeamScope.getState().selectedTeamId === team.id
      ) {
        useTeamScope.getState().clearSelectedTeamKey()
        void queryClient.invalidateQueries({ queryKey: teamKeys.list(userId) })
      }
    },
  })
  const remove = useMutation({
    mutationFn: async (memberId: string) => {
      const user = useAuth.getState().user
      const vaultKey = useVault.getState().key
      const scope = useTeamScope.getState()
      const key = scope.selectedTeamKey
      const version = scope.selectedTeamKeyVersion
      if (
        !user ||
        !vaultKey ||
        !key ||
        scope.selectedTeamId !== team.id ||
        scope.selectedTeamKeyTeamId !== team.id ||
        version !== team.keyVersion
      ) {
        throw new Error('Unlock this team workspace before removing a member.')
      }
      const isCurrent = () => {
        const current = useTeamScope.getState()
        return (
          useAuth.getState().user?.id === user.id &&
          useVault.getState().key === vaultKey &&
          current.selectedTeamId === team.id &&
          current.selectedTeamKey === key &&
          current.selectedTeamKeyVersion === version
        )
      }
      await removeMemberWithRotation(
        team.id,
        memberId,
        version,
        key,
        await getApiClient(),
        isCurrent,
      )
    },
    onSuccess: async () => {
      setRemoveId(null)
      if (useTeamScope.getState().selectedTeamId === team.id)
        useTeamScope.getState().clearSelectedTeamKey()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: teamKeys.list(userId) }),
        queryClient.invalidateQueries({ queryKey: ['vault'] }),
      ])
    },
    onError: (error) => {
      if (
        error instanceof TrominalApiError &&
        error.status === 409 &&
        useTeamScope.getState().selectedTeamId === team.id
      ) {
        useTeamScope.getState().clearSelectedTeamKey()
        void queryClient.invalidateQueries({ queryKey: teamKeys.list(userId) })
      }
    },
  })
  const changeRole = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: TeamRole }) => {
      const api = await getApiClient()
      if (
        useTeamScope.getState().selectedTeamId !== team.id ||
        useAuth.getState().user?.id !== userId ||
        useVault.getState().key === null
      ) {
        throw new Error('The workspace changed or locked. Retry your action.')
      }
      return api.updateTeamMember(team.id, memberId, { role })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })
  function setDialogOpen(next: boolean): void {
    if (add.isPending || remove.isPending || changeRole.isPending) return
    setOpen(next)
    if (!next) {
      form.reset()
      add.reset()
      remove.reset()
      setRemoveId(null)
    }
  }
  const ready =
    selectedKey !== null && selectedKeyTeamId === team.id && selectedKeyVersion === team.keyVersion

  return (
    <Dialog.Root open={open} onOpenChange={setDialogOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="mt-1 flex items-center gap-1 rounded px-1 py-1 text-[11px] text-fg-muted hover:bg-surface-2 hover:text-fg"
        >
          <Users size={12} aria-hidden /> Members
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(90vw,460px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-bg-elev p-5 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-[15px] font-semibold text-fg">
                Team members
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[12px] text-fg-muted">
                {team.name}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                disabled={add.isPending}
                className="rounded p-1 text-fg-faint hover:bg-surface-2 hover:text-fg"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>
          <div className="mt-4 rounded-md border border-border">
            {members.isLoading && <p className="p-3 text-[12px] text-fg-muted">Loading members…</p>}
            {members.isError && (
              <p role="alert" className="p-3 text-[12px] text-danger">
                Could not load team members.
              </p>
            )}
            {members.data?.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 border-b border-border px-3 py-2 text-[12px] last:border-b-0"
              >
                <span className="min-w-0 flex-1 truncate text-fg">
                  {member.user?.email ?? member.user_id}
                </span>
                {canAssignRoles &&
                member.user_id !== userId &&
                !(
                  member.role === 'owner' &&
                  (team.role !== 'owner' ||
                    (members.data?.filter((item) => item.role === 'owner').length ?? 0) <= 1)
                ) ? (
                  <select
                    aria-label={`Role for ${member.user?.email ?? member.user_id}`}
                    value={member.role}
                    disabled={!ready || changeRole.isPending || remove.isPending}
                    onChange={(event) =>
                      changeRole.mutate({
                        memberId: member.id,
                        role: event.target.value as TeamRole,
                      })
                    }
                    className="rounded border border-border bg-surface px-1 py-1 text-fg"
                  >
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                    <option value="admin">Admin</option>
                    {team.role === 'owner' && <option value="owner">Owner</option>}
                  </select>
                ) : (
                  <span className="text-fg-muted">{member.role}</span>
                )}
                {canRemove &&
                  member.user_id !== userId &&
                  !(
                    member.role === 'owner' &&
                    (members.data?.filter((item) => item.role === 'owner').length ?? 0) <= 1
                  ) && (
                    <button
                      type="button"
                      disabled={!ready || remove.isPending}
                      onClick={() => {
                        remove.reset()
                        setRemoveId(member.id)
                      }}
                      aria-label={`Remove ${member.user?.email ?? member.user_id}`}
                      className="rounded px-2 py-1 text-danger hover:bg-surface-2 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
              </div>
            ))}
          </div>
          {changeRole.error && (
            <p role="alert" className="mt-2 text-[12px] text-danger">
              {changeRole.error instanceof Error
                ? changeRole.error.message
                : 'Could not update the role.'}
            </p>
          )}
          {removeId !== null && (
            <div className="mt-4 space-y-2 rounded-md border border-border p-3">
              <p className="text-[12px] text-fg">
                Remove this member? The team key and shared data will be rotated.
              </p>
              {remove.error && (
                <p role="alert" className="text-[12px] text-danger">
                  {remove.error instanceof Error
                    ? remove.error.message
                    : 'Could not remove the member.'}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" disabled={remove.isPending} onClick={() => setRemoveId(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={remove.isPending || !ready}
                  onClick={() => remove.mutate(removeId)}
                >
                  {remove.isPending ? 'Rotating…' : 'Confirm removal'}
                </Button>
              </div>
            </div>
          )}
          {canAdd && (
            <form
              onSubmit={form.handleSubmit((values) => add.mutate(values))}
              className="mt-5 space-y-3 border-t border-border pt-4"
            >
              <p className="text-[12px] font-medium text-fg">Add an existing user</p>
              <div>
                <label htmlFor="team-member-email" className="mb-1 block text-[12px] text-fg-muted">
                  Email
                </label>
                <TextInput
                  id="team-member-email"
                  type="email"
                  autoComplete="off"
                  aria-invalid={!!form.formState.errors.email}
                  {...form.register('email')}
                />
                {form.formState.errors.email && (
                  <p role="alert" className="mt-1 text-[11px] text-danger">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="team-member-role" className="mb-1 block text-[12px] text-fg-muted">
                  Role
                </label>
                <select
                  id="team-member-role"
                  {...form.register('role')}
                  className="h-9 w-full rounded-sm border border-border bg-surface px-2 text-[12px] text-fg"
                >
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                  <option value="admin">Admin</option>
                  {team.role === 'owner' && <option value="owner">Owner</option>}
                </select>
              </div>
              {!ready && (
                <p className="text-[11px] text-fg-muted">Unlock the team key to add a member.</p>
              )}
              {add.error && (
                <p role="alert" className="text-[12px] text-danger">
                  {add.error instanceof TrominalApiError && add.error.status === 409
                    ? 'The team key changed. Wait for the workspace to unlock, then retry.'
                    : add.error instanceof Error
                      ? add.error.message
                      : 'Could not add the member.'}
                </p>
              )}
              <div className="flex justify-end">
                <Button type="submit" disabled={!ready || add.isPending}>
                  {add.isPending && <Loader2 size={13} className="animate-spin" />}Add member
                </Button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
