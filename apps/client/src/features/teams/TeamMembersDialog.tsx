import * as Dialog from '@radix-ui/react-dialog'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Users, X } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { TrominalApiError } from '@trominal/api-client'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { getApiClient } from '@/lib/api-client'
import { useAuth } from '@/stores/auth'
import { useVault } from '@/stores/vault'
import { teamKeys, type TeamSummary } from './api'
import { inviteMember } from './invite-member'
import { useTeamScope } from './store'

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
})
type FormValues = z.infer<typeof schema>

export function TeamMembersDialog({ team, canAdd }: { team: TeamSummary; canAdd: boolean }) {
  const [open, setOpen] = useState(false)
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
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', role: 'member' } })
  const add = useMutation({
    mutationFn: async ({ email, role }: FormValues) => {
      const user = useAuth.getState().user
      const vaultKey = useVault.getState().key
      const scope = useTeamScope.getState()
      const key = scope.selectedTeamKey
      const version = scope.selectedTeamKeyVersion
      if (!user || !vaultKey || !key || scope.selectedTeamId !== team.id || scope.selectedTeamKeyTeamId !== team.id || version === null) {
        throw new Error('Unlock this team workspace before adding a member.')
      }
      if (role === 'owner' && team.role !== 'owner') throw new Error('Only an owner can add another owner.')
      const isCurrent = () => {
        const current = useTeamScope.getState()
        return useAuth.getState().user?.id === user.id && useVault.getState().key === vaultKey &&
          current.selectedTeamId === team.id && current.selectedTeamKey === key &&
          current.selectedTeamKeyTeamId === team.id && current.selectedTeamKeyVersion === version
      }
      return inviteMember(team.id, version, key, email, role, await getApiClient(), isCurrent)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey })
      form.reset()
    },
    onError: (error) => {
      if (error instanceof TrominalApiError && error.status === 409 && useTeamScope.getState().selectedTeamId === team.id) {
        useTeamScope.getState().clearSelectedTeamKey()
        void queryClient.invalidateQueries({ queryKey: teamKeys.list(userId) })
      }
    },
  })
  function setDialogOpen(next: boolean): void {
    if (add.isPending) return
    setOpen(next)
    if (!next) { form.reset(); add.reset() }
  }
  const ready = selectedKey !== null && selectedKeyTeamId === team.id && selectedKeyVersion === team.keyVersion

  return (
    <Dialog.Root open={open} onOpenChange={setDialogOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className="mt-1 flex items-center gap-1 rounded px-1 py-1 text-[11px] text-fg-muted hover:bg-surface-2 hover:text-fg">
          <Users size={12} aria-hidden /> Members
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(90vw,460px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-bg-elev p-5 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-[15px] font-semibold text-fg">Team members</Dialog.Title>
              <Dialog.Description className="mt-1 text-[12px] text-fg-muted">{team.name}</Dialog.Description>
            </div>
            <Dialog.Close asChild><button type="button" aria-label="Close" disabled={add.isPending} className="rounded p-1 text-fg-faint hover:bg-surface-2 hover:text-fg"><X size={16} /></button></Dialog.Close>
          </div>
          <div className="mt-4 rounded-md border border-border">
            {members.isLoading && <p className="p-3 text-[12px] text-fg-muted">Loading members…</p>}
            {members.isError && <p role="alert" className="p-3 text-[12px] text-danger">Could not load team members.</p>}
            {members.data?.map((member) => (
              <div key={member.id} className="flex items-center gap-3 border-b border-border px-3 py-2 text-[12px] last:border-b-0">
                <span className="min-w-0 flex-1 truncate text-fg">{member.user?.email ?? member.user_id}</span>
                <span className="text-fg-muted">{member.role}</span>
              </div>
            ))}
          </div>
          {canAdd && (
            <form onSubmit={form.handleSubmit((values) => add.mutate(values))} className="mt-5 space-y-3 border-t border-border pt-4">
              <p className="text-[12px] font-medium text-fg">Add an existing user</p>
              <div>
                <label htmlFor="team-member-email" className="mb-1 block text-[12px] text-fg-muted">Email</label>
                <TextInput id="team-member-email" type="email" autoComplete="off" aria-invalid={!!form.formState.errors.email} {...form.register('email')} />
                {form.formState.errors.email && <p role="alert" className="mt-1 text-[11px] text-danger">{form.formState.errors.email.message}</p>}
              </div>
              <div>
                <label htmlFor="team-member-role" className="mb-1 block text-[12px] text-fg-muted">Role</label>
                <select id="team-member-role" {...form.register('role')} className="h-9 w-full rounded-sm border border-border bg-surface px-2 text-[12px] text-fg">
                  <option value="member">Member</option><option value="viewer">Viewer</option><option value="admin">Admin</option>
                  {team.role === 'owner' && <option value="owner">Owner</option>}
                </select>
              </div>
              {!ready && <p className="text-[11px] text-fg-muted">Unlock the team key to add a member.</p>}
              {add.error && <p role="alert" className="text-[12px] text-danger">{add.error instanceof TrominalApiError && add.error.status === 409 ? 'The team key changed. Wait for the workspace to unlock, then retry.' : add.error instanceof Error ? add.error.message : 'Could not add the member.'}</p>}
              <div className="flex justify-end"><Button type="submit" disabled={!ready || add.isPending}>{add.isPending && <Loader2 size={13} className="animate-spin" />}Add member</Button></div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
