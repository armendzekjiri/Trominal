import type {
  TeamReencryptedResource,
  TrominalApiClient,
  VaultResourceType,
} from '@trominal/api-client'
import {
  decrypt,
  encrypt,
  fromBase64,
  generateTeamKey,
  makeAd,
  wipe,
  wrapTeamKey,
} from '@trominal/crypto'
import { rotateTeamRecord } from './rotate-record'

const resources: VaultResourceType[] = [
  'groups',
  'hosts',
  'host-credentials',
  'snippets',
  'identities',
  'tunnels',
]

export async function removeMemberWithRotation(
  teamId: string,
  memberId: string,
  version: number,
  oldKey: Uint8Array,
  api: Pick<
    TrominalApiClient,
    'getServerInfo' | 'getTeam' | 'listTeamMembers' | 'listVaultRecords' | 'removeTeamMember'
  >,
  isCurrent: () => boolean,
): Promise<void> {
  const check = () => {
    if (!isCurrent()) throw new Error('The workspace changed or locked. Retry the removal.')
  }
  check()
  const info = await api.getServerInfo()
  check()
  if (info.team_rotation_snapshot_guard !== true)
    throw new Error('Update the server before removing team members.')
  const team = await api.getTeam(teamId)
  check()
  if (team.id !== teamId || team.key_version !== version)
    throw new Error('The team key changed. Refresh and retry.')
  const members = await api.listTeamMembers(teamId)
  check()
  if (!members.some((member) => member.id === memberId))
    throw new Error('This member is no longer in the team.')
  const newKey = await generateTeamKey()
  try {
    check()
    const name = await decrypt(
      { v: 1, ct: team.name_ciphertext, n: team.name_nonce },
      oldKey,
      makeAd('team', teamId),
    )
    let encryptedName
    try {
      check()
      encryptedName = await encrypt(name, newKey, makeAd('team', teamId))
    } finally {
      wipe(name)
    }
    const remaining = []
    for (const member of members) {
      if (member.id === memberId) continue
      check()
      if (!member.user?.public_key) throw new Error('A remaining member has no public key.')
      const wrapped = await wrapTeamKey(newKey, await fromBase64(member.user.public_key), {
        teamId,
        memberId: member.id,
        keyVersion: version + 1,
      })
      remaining.push({
        member_id: member.id,
        wrapped_team_key_ciphertext: wrapped.ciphertext,
        wrapped_team_key_nonce: wrapped.nonce,
      })
    }
    const rotated: TeamReencryptedResource[] = []
    for (const type of resources) {
      check()
      const records = await api.listVaultRecords(type, { teamId })
      for (const record of records) {
        check()
        rotated.push(await rotateTeamRecord(record, teamId, oldKey, newKey))
      }
    }
    check()
    await api.removeTeamMember(teamId, memberId, {
      expected_key_version: version,
      expected_name_ciphertext: team.name_ciphertext,
      expected_name_nonce: team.name_nonce,
      name_ciphertext: encryptedName.ct,
      name_nonce: encryptedName.n,
      remaining_members: remaining,
      reencrypted_resources: rotated,
    })
  } finally {
    wipe(newKey)
  }
}
