import type { TrominalApiClient } from '@trominal/api-client'
import { useTeamScope } from '@/features/teams/store'
import { useAuth } from '@/stores/auth'
import { useVault } from '@/stores/vault'

export function captureVaultWriteScope() {
  const vaultKey = useVault.getState().key
  const user = useAuth.getState().user
  const scope = useTeamScope.getState()
  if (vaultKey === null) throw new Error('Vault is locked.')
  const teamId = scope.selectedTeamId
  const key = teamId === null ? vaultKey : scope.selectedTeamKey
  const version = teamId === null ? null : scope.selectedTeamKeyVersion
  if (
    key === null ||
    (teamId !== null && (scope.selectedTeamKeyTeamId !== teamId || version === null))
  ) {
    throw new Error('Unlock this team workspace before editing records.')
  }
  function assertCurrent(): void {
    const current = useTeamScope.getState()
    if (
      useVault.getState().key !== vaultKey ||
      useAuth.getState().user !== user ||
      current.selectedTeamId !== teamId ||
      (teamId !== null &&
        (current.selectedTeamKey !== key ||
          current.selectedTeamKeyVersion !== version ||
          current.selectedTeamKeyTeamId !== teamId))
    ) {
      throw new Error('The workspace changed or locked. Retry your action.')
    }
  }
  async function requireSupported(api: Pick<TrominalApiClient, 'getServerInfo'>): Promise<void> {
    assertCurrent()
    if (teamId !== null && (await api.getServerInfo()).team_vault_key_version_guard !== true) {
      throw new Error('Update the server before editing shared records.')
    }
    assertCurrent()
  }
  return { teamId, key, version, assertCurrent, requireSupported }
}
