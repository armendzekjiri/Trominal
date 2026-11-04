import { useTeamSummaries } from '@/features/teams/api'
import { useTeamScope } from '@/features/teams/store'
import { useAuth } from '@/stores/auth'

/** Apply both the user's global permission and the selected team's role. */
export function useVaultActionAccess() {
  const selectedTeamId = useTeamScope((state) => state.selectedTeamId)
  const hasPermission = useAuth((state) => state.hasPermission)
  const teams = useTeamSummaries().data
  const team = teams?.find((item) => item.id === selectedTeamId)
  const teamAllows = selectedTeamId === null || (team !== undefined && team.role !== 'viewer')
  return (permission: string) => teamAllows && hasPermission(permission)
}
