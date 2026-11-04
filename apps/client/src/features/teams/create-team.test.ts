import { describe, expect, it, vi } from 'vitest'
import type { TrominalApiClient } from '@trominal/api-client'
import {
  decryptToString,
  generateX25519KeyPair,
  makeAd,
  unwrapTeamKey,
  wipe,
} from '@trominal/crypto'
import { createTeamOnServer, createTeamPayload } from './create-team'

describe('team creation encryption', () => {
  it('does not create an unusable team on an older server', async () => {
    const api = { getServerInfo: vi.fn().mockResolvedValue({}), createTeam: vi.fn() }
    await expect(
      createTeamOnServer('Operations', new Uint8Array(32), api as unknown as TrominalApiClient),
    ).rejects.toThrow('server')
    expect(api.createTeam).not.toHaveBeenCalled()
  })

  it('checks that the server used the IDs bound into the encrypted payload', async () => {
    const owner = await generateX25519KeyPair()
    try {
      const api = {
        getServerInfo: vi.fn().mockResolvedValue({ team_client_member_ids: true }),
        createTeam: vi
          .fn()
          .mockImplementation(async (payload: { id: string; member_id: string }) => ({
            id: payload.id,
            current_member: { id: 'unexpected' },
          })),
      }
      await expect(
        createTeamOnServer('Operations', owner.publicKey, api as unknown as TrominalApiClient),
      ).rejects.toThrow('unexpected team identifiers')
      expect(api.createTeam).toHaveBeenCalledOnce()
    } finally {
      wipe(owner.privateKey)
    }
  })
  it('binds the encrypted name and owner key to IDs that are sent to the API', async () => {
    const owner = await generateX25519KeyPair()
    let teamKey: Uint8Array | null = null
    try {
      const payload = await createTeamPayload('Operations', owner.publicKey)
      expect(JSON.stringify(payload)).not.toContain('Operations')
      teamKey = await unwrapTeamKey(
        { ciphertext: payload.wrapped_team_key_ciphertext, nonce: payload.wrapped_team_key_nonce },
        owner,
        { teamId: payload.id, memberId: payload.member_id, keyVersion: 1 },
      )
      expect(
        await decryptToString(
          { v: 1, ct: payload.name_ciphertext, n: payload.name_nonce },
          teamKey,
          makeAd('team', payload.id),
        ),
      ).toBe('Operations')
      await expect(
        unwrapTeamKey(
          {
            ciphertext: payload.wrapped_team_key_ciphertext,
            nonce: payload.wrapped_team_key_nonce,
          },
          owner,
          { teamId: payload.id, memberId: 'wrong-member', keyVersion: 1 },
        ),
      ).rejects.toThrow()
    } finally {
      if (teamKey) wipe(teamKey)
      wipe(owner.privateKey)
    }
  })
})
