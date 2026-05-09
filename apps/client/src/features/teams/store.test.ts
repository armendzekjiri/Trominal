import { beforeEach, describe, expect, it } from 'vitest'

import { selectedTeamScope, useTeamScope } from './store'

beforeEach(() => {
  useTeamScope.getState().setPersonalScope()
})

describe('team scope store', () => {
  it('starts in personal scope and can switch to a team', () => {
    expect(selectedTeamScope(useTeamScope.getState().selectedTeamId)).toEqual({ kind: 'personal' })

    useTeamScope.getState().setTeamScope('team_01')

    expect(selectedTeamScope(useTeamScope.getState().selectedTeamId)).toEqual({
      kind: 'team',
      teamId: 'team_01',
    })
  })

  it('falls back to personal when the selected team disappears', () => {
    useTeamScope.getState().setTeamScope('team_02')

    useTeamScope.getState().reconcileTeamIds(['team_01'])

    expect(useTeamScope.getState().selectedTeamId).toBeNull()
  })

  it('keeps a selected team that is still present', () => {
    useTeamScope.getState().setTeamScope('team_02')

    useTeamScope.getState().reconcileTeamIds(['team_01', 'team_02'])

    expect(useTeamScope.getState().selectedTeamId).toBe('team_02')
  })

  it('wipes the selected team key when returning to personal scope', () => {
    const key = new Uint8Array(32).fill(9)

    useTeamScope.getState().setTeamScope('team_02')
    useTeamScope.getState().setSelectedTeamKey('team_02', 1, key)
    useTeamScope.getState().setPersonalScope()

    expect(useTeamScope.getState().selectedTeamKey).toBeNull()
    expect(Array.from(key).every((byte) => byte === 0)).toBe(true)
  })
})
