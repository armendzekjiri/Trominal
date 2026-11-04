import { afterEach, describe, expect, it } from 'vitest'
import { useTeamScope } from '@/features/teams/store'
import { useVault } from '@/stores/vault'
import { captureVaultWriteScope } from './write-scope'

afterEach(() => {
  useTeamScope.getState().setPersonalScope()
  useVault.setState({ key: null })
})

describe('vault write scope', () => {
  it('requires a versioned team key and detects workspace changes', () => {
    useVault.setState({ key: new Uint8Array(32).fill(1) })
    useTeamScope.getState().setTeamScope('team')
    expect(() => captureVaultWriteScope()).toThrow('Unlock')
    const key = new Uint8Array(32).fill(2)
    useTeamScope.getState().setSelectedTeamKey('team', 3, key)
    const scope = captureVaultWriteScope()
    expect(scope.teamId).toBe('team')
    expect(scope.version).toBe(3)
    expect(scope.key).toBe(key)
    useTeamScope.getState().setPersonalScope()
    expect(() => scope.assertCurrent()).toThrow('changed')
  })

  it('rejects older servers before allowing a team write', async () => {
    useVault.setState({ key: new Uint8Array(32).fill(1) })
    useTeamScope.getState().setTeamScope('team')
    useTeamScope.getState().setSelectedTeamKey('team', 1, new Uint8Array(32).fill(2))
    const scope = captureVaultWriteScope()
    await expect(
      scope.requireSupported({
        getServerInfo: async () => ({ team_vault_key_version_guard: false }) as never,
      }),
    ).rejects.toThrow('Update the server')
  })
})
