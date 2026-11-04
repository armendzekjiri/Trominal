import { act, renderHook } from '@testing-library/react'
import type { UserDto } from '@trominal/api-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTeamSummaries } from '@/features/teams/api'
import { useTeamScope } from '@/features/teams/store'
import { useAuth } from '@/stores/auth'
import { useVaultActionAccess } from './access'

vi.mock('@/features/teams/api', () => ({ useTeamSummaries: vi.fn() }))

describe('team vault actions', () => {
  beforeEach(() => {
    useAuth.setState({
      user: { id: 'user', permissions: ['hosts.create', 'hosts.connect'] } as UserDto,
    })
    useTeamScope.getState().setPersonalScope()
  })
  it('requires global permission and disallows edits and connections for team viewers', () => {
    vi.mocked(useTeamSummaries).mockReturnValue({ data: [{ id: 'team', role: 'viewer' }] } as never)
    const { result } = renderHook(() => useVaultActionAccess())
    expect(result.current('hosts.create')).toBe(true)
    expect(result.current('hosts.delete')).toBe(false)
    act(() => useTeamScope.getState().setTeamScope('team'))
    expect(result.current('hosts.create')).toBe(false)
    expect(result.current('hosts.connect')).toBe(false)
  })
})
