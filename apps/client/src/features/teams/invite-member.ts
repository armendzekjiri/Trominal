import type { AddTeamMemberRequest, TeamMemberDto, TeamRole, TrominalApiClient } from '@trominal/api-client'
import { fromBase64, wrapTeamKey } from '@trominal/crypto'
import { newVaultId } from '@/features/vault/ids'

type MemberPayload = AddTeamMemberRequest & { member_id: string }

export async function createMemberPayload(
  teamId: string,
  keyVersion: number,
  teamKey: Uint8Array,
  userId: string,
  publicKey: Uint8Array,
  role: TeamRole,
): Promise<MemberPayload> {
  const memberId = newVaultId()
  const wrapped = await wrapTeamKey(teamKey, publicKey, { teamId, memberId, keyVersion })
  return {
    member_id: memberId,
    expected_key_version: keyVersion,
    user_id: userId,
    role,
    wrapped_team_key_ciphertext: wrapped.ciphertext,
    wrapped_team_key_nonce: wrapped.nonce,
  }
}

export async function inviteMember(
  teamId: string,
  keyVersion: number,
  teamKey: Uint8Array,
  email: string,
  role: TeamRole,
  api: Pick<TrominalApiClient, 'getServerInfo' | 'lookupTeamUser' | 'addTeamMember'>,
  isCurrent: () => boolean,
): Promise<TeamMemberDto> {
  const requireCurrent = () => {
    if (!isCurrent()) throw new Error('The workspace changed or locked. Select the team again and retry.')
  }
  requireCurrent()
  const info = await api.getServerInfo()
  if (info.team_client_member_ids !== true || info.team_member_key_version_guard !== true) {
    throw new Error('This server must be updated before team members can be added safely.')
  }
  requireCurrent()
  const user = await api.lookupTeamUser(email.trim())
  requireCurrent()
  const payload = await createMemberPayload(teamId, keyVersion, teamKey, user.id, await fromBase64(user.public_key), role)
  requireCurrent()
  const member = await api.addTeamMember(teamId, payload)
  if (member.id !== payload.member_id || member.key_version !== keyVersion || member.user_id !== user.id || member.role !== role) {
    throw new Error('The server returned unexpected membership information. The team key could not be verified.')
  }
  return member
}
