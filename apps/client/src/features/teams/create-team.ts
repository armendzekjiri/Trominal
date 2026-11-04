import type { CreateTeamRequest, TeamDto, TrominalApiClient } from '@trominal/api-client'
import { encrypt, generateTeamKey, makeAd, wipe, wrapTeamKey } from '@trominal/crypto'
import { newVaultId } from '@/features/vault/ids'

export type ClientTeamCreateRequest = CreateTeamRequest & { id: string; member_id: string }

/** Prepare only encrypted team data for the API. The generated team key stays local. */
export async function createTeamPayload(
  name: string,
  ownerPublicKey: Uint8Array,
): Promise<ClientTeamCreateRequest> {
  const trimmed = name.trim()
  if (trimmed.length === 0 || trimmed.length > 120)
    throw new Error('Team name must be 1–120 characters.')
  const id = newVaultId()
  const memberId = newVaultId()
  const teamKey = await generateTeamKey()
  try {
    const encryptedName = await encrypt(trimmed, teamKey, makeAd('team', id))
    const wrapped = await wrapTeamKey(teamKey, ownerPublicKey, {
      teamId: id,
      memberId,
      keyVersion: 1,
    })
    return {
      id,
      member_id: memberId,
      name_ciphertext: encryptedName.ct,
      name_nonce: encryptedName.n,
      wrapped_team_key_ciphertext: wrapped.ciphertext,
      wrapped_team_key_nonce: wrapped.nonce,
    }
  } finally {
    wipe(teamKey)
  }
}

export async function createTeamOnServer(
  name: string,
  ownerPublicKey: Uint8Array,
  api: Pick<TrominalApiClient, 'getServerInfo' | 'createTeam'>,
): Promise<TeamDto> {
  const info = await api.getServerInfo()
  if (info.team_client_member_ids !== true) {
    throw new Error('This server must be updated before encrypted teams can be created.')
  }
  const payload = await createTeamPayload(name, ownerPublicKey)
  const team = await api.createTeam(payload)
  if (team.id !== payload.id || team.current_member.id !== payload.member_id) {
    throw new Error(
      'The server returned unexpected team identifiers. The team key could not be verified.',
    )
  }
  return team
}
