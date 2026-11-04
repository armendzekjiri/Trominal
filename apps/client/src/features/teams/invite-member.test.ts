import { describe, expect, it, vi } from 'vitest'
import type { TrominalApiClient } from '@trominal/api-client'
import { generateTeamKey, generateX25519KeyPair, toBase64, unwrapTeamKey, wipe } from '@trominal/crypto'
import { createMemberPayload, inviteMember } from './invite-member'

describe('team member key wrapping', () => {
  it('binds the wrapped key to the new member ID and current key version', async () => {
    const key = await generateTeamKey()
    const recipient = await generateX25519KeyPair()
    let unwrapped: Uint8Array | null = null
    try {
      const payload = await createMemberPayload('team-id', 3, key, 'user-id', recipient.publicKey, 'member')
      unwrapped = await unwrapTeamKey(
        { ciphertext: payload.wrapped_team_key_ciphertext, nonce: payload.wrapped_team_key_nonce },
        recipient,
        { teamId: 'team-id', memberId: payload.member_id, keyVersion: 3 },
      )
      expect(unwrapped).toEqual(key)
      expect(payload.expected_key_version).toBe(3)
      await expect(unwrapTeamKey(
        { ciphertext: payload.wrapped_team_key_ciphertext, nonce: payload.wrapped_team_key_nonce },
        recipient,
        { teamId: 'team-id', memberId: payload.member_id, keyVersion: 4 },
      )).rejects.toThrow()
    } finally {
      if (unwrapped) wipe(unwrapped)
      wipe(key)
      wipe(recipient.privateKey)
    }
  })

  it('does not add a member if the active team key was cleared during preparation', async () => {
    const key = await generateTeamKey()
    const recipient = await generateX25519KeyPair()
    try {
      const api = {
        getServerInfo: vi.fn().mockResolvedValue({ team_client_member_ids: true, team_member_key_version_guard: true }),
        lookupTeamUser: vi.fn().mockResolvedValue({ id: 'user-id', public_key: await toBase64(recipient.publicKey) }),
        addTeamMember: vi.fn(),
      }
      const isCurrent = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValue(false)
      await expect(inviteMember('team-id', 1, key, 'member@example.com', 'member', api as unknown as TrominalApiClient, isCurrent)).rejects.toThrow('workspace')
      expect(api.addTeamMember).not.toHaveBeenCalled()
      expect(api.lookupTeamUser).toHaveBeenCalledOnce()
    } finally {
      wipe(key)
      wipe(recipient.privateKey)
    }
  })
})
