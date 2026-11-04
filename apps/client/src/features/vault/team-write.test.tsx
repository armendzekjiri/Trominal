import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { decryptHost } from './model'
import { useSaveHost } from './hooks'
import { useTeamScope } from '@/features/teams/store'
import { useVault } from '@/stores/vault'
import { getApiClient } from '@/lib/api-client'

vi.mock('@/lib/api-client', () => ({ getApiClient: vi.fn(), getActiveApiBaseUrl: () => '' }))

describe('shared vault writes', () => {
  const create = vi.fn()
  const info = vi.fn()
  const key = new Uint8Array(32).fill(11)
  beforeEach(() => {
    create.mockReset()
    info.mockReset().mockResolvedValue({ team_vault_key_version_guard: true })
    vi.mocked(getApiClient).mockResolvedValue({
      getServerInfo: info,
      createVaultRecord: create,
    } as never)
    useVault.setState({ key: new Uint8Array(32).fill(1) })
    useTeamScope.getState().setPersonalScope()
    useTeamScope.getState().setTeamScope('team')
    useTeamScope.getState().setSelectedTeamKey('team', 4, key)
  })
  it('encrypts a host for the selected team and includes its key version', async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useSaveHost(), { wrapper })
    await act(async () =>
      result.current.mutateAsync({
        name: 'shared',
        hostname: 'host',
        port: '',
        username: '',
        tags: [],
        color: '',
        groupId: null,
      }),
    )
    expect(create).toHaveBeenCalledOnce()
    const payload = create.mock.calls[0]?.[1]
    expect(payload).toMatchObject({ team_id: 'team', team_key_version: 4 })
    expect(
      (
        await decryptHost(
          { ...payload, type: 'hosts', created_at: null, updated_at: null, deleted_at: null },
          key,
        )
      ).name,
    ).toBe('shared')
  })
  it('does not write to a server without the version guard', async () => {
    info.mockResolvedValue({})
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useSaveHost(), { wrapper })
    await expect(
      result.current.mutateAsync({
        name: 'shared',
        hostname: 'host',
        port: '',
        username: '',
        tags: [],
        color: '',
        groupId: null,
      }),
    ).rejects.toThrow('Update the server')
    expect(create).not.toHaveBeenCalled()
  })
})
