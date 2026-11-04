import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { UserDto } from '@trominal/api-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '@/stores/auth'
import { useVault } from '@/stores/vault'
import { useTeamScope } from './store'
import { CreateTeamDialog } from './CreateTeamDialog'
import { createTeamOnServer } from './create-team'

vi.mock('@/lib/api-client', () => ({ getApiClient: vi.fn().mockResolvedValue({}) }))
vi.mock('./create-team', () => ({ createTeamOnServer: vi.fn() }))

describe('team creation dialog', () => {
  beforeEach(() => {
    useTeamScope.getState().setPersonalScope()
    useAuth.setState({
      user: {
        id: 'user1',
        vault: { public_key: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' },
      } as UserDto,
    })
    useVault.setState({ key: new Uint8Array(32) })
    vi.mocked(createTeamOnServer).mockReset()
  })

  it('creates a team and selects it after refreshing the team list', async () => {
    vi.mocked(createTeamOnServer).mockResolvedValue({ id: 'team1' } as Awaited<
      ReturnType<typeof createTeamOnServer>
    >)
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <CreateTeamDialog />
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Create team' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Team name'), {
      target: { value: 'Operations' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create team' }))
    await waitFor(() => expect(useTeamScope.getState().selectedTeamId).toBe('team1'))
    expect(createTeamOnServer).toHaveBeenCalledWith('Operations', expect.any(Uint8Array), {})
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
