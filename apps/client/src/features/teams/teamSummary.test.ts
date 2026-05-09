import { describe, expect, it } from 'vitest'

import type { TeamDto, UserDto } from '@trominal/api-client'
import {
  encrypt,
  generateTeamKey,
  generateX25519KeyPair,
  makeAd,
  secureRandom,
  toBase64,
  wipe,
  wrapTeamKey,
} from '@trominal/crypto'

import { decryptTeamSummary, fallbackTeamName } from './api'

function userDto(
  publicKey: string,
  privateKeyCiphertext: string,
  privateKeyNonce: string,
): UserDto {
  return {
    id: 'user_01',
    name: 'Team User',
    email: 'team-user@example.com',
    roles: ['user'],
    permissions: ['teams.read.own'],
    vault: {
      kdf_salt: 'salt',
      kdf_params: {
        version: 1,
        alg: 'argon2id',
        memlimit: 8 * 1024 * 1024,
        opslimit: 2,
        salt_len: 16,
        out_len: 32,
      },
      public_key: publicKey,
      private_key_ciphertext: privateKeyCiphertext,
      private_key_nonce: privateKeyNonce,
    },
    two_factor_enabled: false,
    suspended_at: null,
    created_at: null,
    updated_at: null,
  }
}

describe('decryptTeamSummary', () => {
  it('unwraps the member team key and decrypts the team name', async () => {
    const teamId = 'team_01HZK8J65W7B2F5E2Q3M4N5P6R'
    const memberId = 'member_01'
    const vaultKey = await secureRandom(32)
    const memberKeys = await generateX25519KeyPair()
    const teamKey = await generateTeamKey()

    try {
      const privateKeyEnvelope = await encrypt(
        memberKeys.privateKey,
        vaultKey,
        makeAd('user_private_key', 'team-user@example.com'),
      )
      const wrappedTeamKey = await wrapTeamKey(teamKey, memberKeys.publicKey, {
        teamId,
        memberId,
        keyVersion: 1,
      })
      const nameEnvelope = await encrypt('Operations', teamKey, makeAd('team', teamId))
      const user = userDto(
        await toBase64(memberKeys.publicKey),
        privateKeyEnvelope.ct,
        privateKeyEnvelope.n,
      )
      const team: TeamDto = {
        id: teamId,
        name_ciphertext: nameEnvelope.ct,
        name_nonce: nameEnvelope.n,
        key_version: 1,
        current_member: {
          id: memberId,
          team_id: teamId,
          user_id: String(user.id),
          role: 'admin',
          wrapped_team_key_ciphertext: wrappedTeamKey.ciphertext,
          wrapped_team_key_nonce: wrappedTeamKey.nonce,
          key_version: 1,
          created_at: null,
          updated_at: null,
        },
        created_at: null,
        updated_at: null,
      }

      await expect(decryptTeamSummary(team, user, vaultKey)).resolves.toMatchObject({
        id: teamId,
        name: 'Operations',
        role: 'admin',
        keyVersion: 1,
        memberId,
        decryptable: true,
      })
    } finally {
      wipe(vaultKey)
      wipe(memberKeys.privateKey)
      wipe(teamKey)
    }
  })

  it('generates a short fallback label from the team id', () => {
    expect(fallbackTeamName('team_abcdef')).toBe('Team abcdef')
  })
})
