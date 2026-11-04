import * as Dialog from '@radix-ui/react-dialog'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { fromBase64 } from '@trominal/crypto'
import { Loader2, Plus, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { getApiClient } from '@/lib/api-client'
import { useAuth } from '@/stores/auth'
import { useVault } from '@/stores/vault'
import { teamKeys } from './api'
import { createTeamOnServer } from './create-team'
import { useTeamScope } from './store'

const schema = z.object({ name: z.string().trim().min(1, 'Enter a team name.').max(120) })
type FormValues = z.infer<typeof schema>

export function CreateTeamDialog() {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const requestVaultKey = useRef<Uint8Array | null>(null)
  const setTeamScope = useTeamScope((state) => state.setTeamScope)
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: '' } })
  const create = useMutation({
    mutationFn: async ({ name }: FormValues) => {
      const user = useAuth.getState().user
      const vaultKey = useVault.getState().key
      if (user === null || vaultKey === null)
        throw new Error('Unlock your vault before creating a team.')
      requestVaultKey.current = vaultKey
      const publicKey = await fromBase64(user.vault.public_key)
      const api = await getApiClient()
      const team = await createTeamOnServer(name, publicKey, api)
      return { team, userId: String(user.id) }
    },
    onSuccess: async ({ team, userId }) => {
      if (
        String(useAuth.getState().user?.id ?? '') !== userId ||
        useVault.getState().key !== requestVaultKey.current
      )
        return
      await queryClient.invalidateQueries({ queryKey: teamKeys.list(userId) })
      if (
        String(useAuth.getState().user?.id ?? '') !== userId ||
        useVault.getState().key !== requestVaultKey.current
      )
        return
      setTeamScope(team.id)
      form.reset()
      setOpen(false)
    },
    onSettled: () => {
      requestVaultKey.current = null
    },
  })

  function setDialogOpen(next: boolean): void {
    if (create.isPending) return
    setOpen(next)
    if (!next) {
      form.reset()
      create.reset()
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setDialogOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="mt-1.5 flex items-center gap-1 rounded px-1 py-1 text-[11px] text-fg-muted hover:bg-surface-2 hover:text-fg"
        >
          <Plus size={12} aria-hidden /> Create team
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(90vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-bg-elev p-5 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-[15px] font-semibold text-fg">Create team</Dialog.Title>
              <Dialog.Description className="mt-1 text-[12px] text-fg-muted">
                The team name and shared items are encrypted on your device. You can add existing
                users after creation.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                disabled={create.isPending}
                className="rounded p-1 text-fg-faint hover:bg-surface-2 hover:text-fg"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>
          <form
            onSubmit={form.handleSubmit((values) => create.mutate(values))}
            className="mt-5 space-y-4"
          >
            <div>
              <label
                htmlFor="new-team-name"
                className="mb-1.5 block text-[12px] font-medium text-fg-muted"
              >
                Team name
              </label>
              <TextInput
                id="new-team-name"
                autoComplete="off"
                maxLength={120}
                aria-invalid={!!form.formState.errors.name}
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p role="alert" className="mt-1 text-[11px] text-danger">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            {create.error && (
              <p role="alert" className="text-[12px] text-danger">
                {create.error instanceof Error
                  ? create.error.message
                  : 'Could not create the team.'}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={create.isPending}
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 size={13} className="animate-spin" />}Create team
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
