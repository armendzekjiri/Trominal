import { useQuery } from '@tanstack/react-query'

import type { TeamDto, TeamRole, UserDto } from '@trominal/api-client'
import { decrypt, decryptToString, fromBase64, makeAd, unwrapTeamKey, wipe } from '@trominal/crypto'

import { getApiClient } from '@/lib/api-client'
import { useAuth } from '@/stores/auth'
import { useVault } from '@/stores/vault'

export type TeamSummary = {
  id: string
  name: string
  role: TeamRole
  keyVersion: number
  memberId: string
  decryptable: boolean
}

export const teamKeys = {
  list: (userId: string) => ['teams', userId] as const,
}

export function fallbackTeamName(teamId: string): string {
  const suffix = teamId.slice(-6)

  return `Team ${suffix.length > 0 ? suffix : teamId}`
}

export async function decryptTeamSummary(
  team: TeamDto,
  user: UserDto,
  vaultKey: Uint8Array,
): Promise<TeamSummary> {
  let teamKey: Uint8Array | null = null

  try {
    teamKey = await unwrapTeamKeyForTeam(team, user, vaultKey)

    const name = await decryptToString(
      { v: 1, ct: team.name_ciphertext, n: team.name_nonce },
      teamKey,
      makeAd('team', team.id),
    )

    return {
      id: team.id,
      name: name.trim().length > 0 ? name : fallbackTeamName(team.id),
      role: team.current_member.role,
      keyVersion: team.key_version,
      memberId: team.current_member.id,
      decryptable: true,
    }
  } finally {
    if (teamKey !== null) {
      wipe(teamKey)
    }
  }
}

export async function unwrapTeamKeyForTeam(
  team: TeamDto,
  user: UserDto,
  vaultKey: Uint8Array,
): Promise<Uint8Array> {
  let privateKey: Uint8Array | null = null

  try {
    privateKey = await decrypt(
      {
        v: 1,
        ct: user.vault.private_key_ciphertext,
        n: user.vault.private_key_nonce,
      },
      vaultKey,
      makeAd('user_private_key', user.email),
    )

    const publicKey = await fromBase64(user.vault.public_key)

    return await unwrapTeamKey(
      {
        ciphertext: team.current_member.wrapped_team_key_ciphertext,
        nonce: team.current_member.wrapped_team_key_nonce,
      },
      { publicKey, privateKey },
      {
        teamId: team.id,
        memberId: team.current_member.id,
        keyVersion: team.current_member.key_version,
      },
    )
  } finally {
    if (privateKey !== null) {
      wipe(privateKey)
    }
  }
}

function fallbackTeamSummary(team: TeamDto): TeamSummary {
  return {
    id: team.id,
    name: fallbackTeamName(team.id),
    role: team.current_member.role,
    keyVersion: team.key_version,
    memberId: team.current_member.id,
    decryptable: false,
  }
}

export function useTeamSummaries() {
  const key = useVault((state) => state.key)
  const user = useAuth((state) => state.user)
  const canReadTeams = useAuth((state) => state.hasPermission('teams.read.own'))

  return useQuery({
    queryKey: teamKeys.list(String(user?.id ?? 'anonymous')),
    enabled: key !== null && user !== null && canReadTeams,
    queryFn: async () => {
      if (key === null || user === null) {
        return []
      }

      const api = await getApiClient()
      const teams = await api.listTeams()

      return Promise.all(
        teams.map(async (team) => {
          try {
            return await decryptTeamSummary(team, user, key)
          } catch {
            return fallbackTeamSummary(team)
          }
        }),
      )
    },
  })
}
