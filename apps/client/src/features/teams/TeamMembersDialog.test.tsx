import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { TrominalApiClient, UserDto } from '@trominal/api-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getApiClient } from '@/lib/api-client'
import { useAuth } from '@/stores/auth'
import { useVault } from '@/stores/vault'
import { inviteMember } from './invite-member'
import { removeMemberWithRotation } from './remove-member'
import { TeamMembersDialog } from './TeamMembersDialog'
import { useTeamScope } from './store'

vi.mock('@/lib/api-client', () => ({ getApiClient: vi.fn() }))
vi.mock('./invite-member', () => ({ inviteMember: vi.fn() }))
vi.mock('./remove-member', () => ({ removeMemberWithRotation: vi.fn() }))

const team = {
  id: 'team1',
  name: 'Operations',
  role: 'owner' as const,
  keyVersion: 1,
  memberId: 'owner1',
  decryptable: true,
}
const api = {
  listTeamMembers: vi
    .fn()
    .mockResolvedValue([
      { id: 'owner1', user_id: 'user1', role: 'owner', user: { email: 'owner@example.com' } },
    ]),
  updateTeamMember: vi.fn().mockResolvedValue({}),
}

describe('team members dialog', () => {
  beforeEach(() => {
    useAuth.setState({ user: { id: 'user1' } as UserDto })
    useVault.setState({ key: new Uint8Array(32) })
    useTeamScope.getState().setTeamScope('team1')
    useTeamScope.getState().setSelectedTeamKey('team1', 1, new Uint8Array(32).fill(2))
    vi.mocked(getApiClient).mockResolvedValue(api as unknown as TrominalApiClient)
    vi.mocked(inviteMember).mockReset()
  })

  it('adds an existing user using the selected team key and refreshes members', async () => {
    vi.mocked(inviteMember).mockResolvedValue({} as Awaited<ReturnType<typeof inviteMember>>)
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    render(
      <QueryClientProvider client={client}>
        <TeamMembersDialog team={team} canAdd canAssignRoles />
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Members' }))
    const dialog = screen.getByRole('dialog')
    await within(dialog).findByText('owner@example.com')
    fireEvent.change(within(dialog).getByLabelText('Email'), {
      target: { value: 'member@example.com' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add member' }))
    await waitFor(() => expect(inviteMember).toHaveBeenCalledOnce())
    expect(inviteMember).toHaveBeenCalledWith(
      'team1',
      1,
      expect.any(Uint8Array),
      'member@example.com',
      'member',
      api,
      expect.any(Function),
    )
  })

  it('does not offer member changes to a read-only member', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <TeamMembersDialog team={{ ...team, role: 'viewer' }} canAdd={false} />
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Members' }))
    expect(
      within(screen.getByRole('dialog')).queryByRole('button', { name: 'Add member' }),
    ).toBeNull()
  })

  it('asks for confirmation before rotating the key and removing a member', async () => {
    api.listTeamMembers.mockResolvedValueOnce([
      { id: 'owner1', user_id: 'user1', role: 'owner', user: { email: 'owner@example.com' } },
      { id: 'member1', user_id: 'user2', role: 'member', user: { email: 'member@example.com' } },
    ])
    vi.mocked(removeMemberWithRotation).mockResolvedValue(undefined)
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    render(
      <QueryClientProvider client={client}>
        <TeamMembersDialog team={team} canAdd canRemove />
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Members' }))
    await screen.findByText('member@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Remove member@example.com' }))
    expect(removeMemberWithRotation).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm removal' }))
    await waitFor(() => expect(removeMemberWithRotation).toHaveBeenCalledOnce())
  })

  it('lets a manager change another member role', async () => {
    api.listTeamMembers.mockResolvedValueOnce([
      { id: 'owner1', user_id: 'user1', role: 'owner', user: { email: 'owner@example.com' } },
      { id: 'member1', user_id: 'user2', role: 'member', user: { email: 'member@example.com' } },
    ])
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    render(
      <QueryClientProvider client={client}>
        <TeamMembersDialog team={team} canAdd canAssignRoles />
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Members' }))
    await screen.findByText('member@example.com')
    fireEvent.change(screen.getByLabelText('Role for member@example.com'), {
      target: { value: 'viewer' },
    })
    await waitFor(() =>
      expect(api.updateTeamMember).toHaveBeenCalledWith('team1', 'member1', { role: 'viewer' }),
    )
  })
})
