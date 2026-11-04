import { describe, expect, it, vi } from 'vitest'
import {
  decryptToString,
  encrypt,
  generateX25519KeyPair,
  makeAd,
  toBase64,
  unwrapTeamKey,
  wipe,
} from '@trominal/crypto'
import { removeMemberWithRotation } from './remove-member'

describe('member removal key rotation', () => {
  it('rewraps the new key and re-encrypts the team name and every record', async () => {
    const owner = await generateX25519KeyPair()
    const oldKey = new Uint8Array(32).fill(7)
    const teamName = await encrypt('Operations', oldKey, makeAd('team', 'team'))
    const name = await encrypt('host', oldKey, makeAd('team_host', 'host:team'))
    const api = {
      getServerInfo: vi.fn().mockResolvedValue({ team_rotation_snapshot_guard: true }),
      getTeam: vi
        .fn()
        .mockResolvedValue({
          id: 'team',
          key_version: 1,
          name_ciphertext: teamName.ct,
          name_nonce: teamName.n,
        }),
      listTeamMembers: vi
        .fn()
        .mockResolvedValue([
          { id: 'owner', user: { public_key: await toBase64(owner.publicKey) } },
          { id: 'removed' },
        ]),
      listVaultRecords: vi
        .fn()
        .mockImplementation(async (type: string) =>
          type === 'hosts'
            ? [
                {
                  id: 'host',
                  team_id: 'team',
                  type,
                  name_ciphertext: name.ct,
                  name_nonce: name.n,
                  created_at: null,
                  updated_at: null,
                  deleted_at: null,
                },
              ]
            : [],
        ),
      removeTeamMember: vi.fn().mockResolvedValue(undefined),
    }
    try {
      await removeMemberWithRotation('team', 'removed', 1, oldKey, api as never, () => true)
      const payload = api.removeTeamMember.mock.calls[0]?.[2]
      expect(payload.expected_name_ciphertext).toBe(teamName.ct)
      expect(payload.reencrypted_resources).toHaveLength(1)
      const wrap = payload.remaining_members[0]
      const newKey = await unwrapTeamKey(
        { ciphertext: wrap.wrapped_team_key_ciphertext, nonce: wrap.wrapped_team_key_nonce },
        owner,
        { teamId: 'team', memberId: 'owner', keyVersion: 2 },
      )
      try {
        expect(
          await decryptToString(
            { v: 1, ct: payload.name_ciphertext, n: payload.name_nonce },
            newKey,
            makeAd('team', 'team'),
          ),
        ).toBe('Operations')
        const fields = payload.reencrypted_resources[0].fields
        expect(
          await decryptToString(
            { v: 1, ct: fields.name_ciphertext, n: fields.name_nonce },
            newKey,
            makeAd('team_host', 'host:team'),
          ),
        ).toBe('host')
      } finally {
        wipe(newKey)
      }
    } finally {
      wipe(owner.privateKey)
    }
  })

  it('does not send a removal after the workspace changes', async () => {
    const api = {
      getServerInfo: vi.fn().mockResolvedValue({ team_rotation_snapshot_guard: true }),
      removeTeamMember: vi.fn(),
    }
    await expect(
      removeMemberWithRotation('team', 'member', 1, new Uint8Array(32), api as never, () => false),
    ).rejects.toThrow('changed')
    expect(api.removeTeamMember).not.toHaveBeenCalled()
  })
})
