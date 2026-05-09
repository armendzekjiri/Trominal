import { describe, expect, it } from 'vitest'
import { fromBase64 } from '../src/encoding'
import { generateX25519KeyPair } from '../src/keys'
import { generateTeamKey, makeTeamKeyAd, unwrapTeamKey, wrapTeamKey } from '../src/team-key'

describe('team key wrapping', () => {
  it('generates 32-byte team keys', async () => {
    expect((await generateTeamKey()).length).toBe(32)
  })

  it('builds AD that binds the team, member, and key version', () => {
    expect(makeTeamKeyAd({ teamId: 'team_01', memberId: 'member_02', keyVersion: 3 })).toBe(
      'trominal:v1:team_key:team_01:member:member_02:v3',
    )
  })

  it('wraps and unwraps a team key for one member', async () => {
    const member = await generateX25519KeyPair()
    const teamKey = await generateTeamKey()
    const context = {
      teamId: '01JZTEAM000000000000000001',
      memberId: '01JZMEMBER00000000000001',
      keyVersion: 1,
    }

    const wrapped = await wrapTeamKey(teamKey, member.publicKey, context)
    const unwrapped = await unwrapTeamKey(wrapped, member, context)

    expect(Buffer.from(unwrapped).equals(Buffer.from(teamKey))).toBe(true)
    expect((await fromBase64(wrapped.ciphertext)).length).toBeGreaterThan(teamKey.length)
    expect((await fromBase64(wrapped.nonce)).length).toBe(24)
  })

  it('fails when opened by the wrong member keypair', async () => {
    const member = await generateX25519KeyPair()
    const wrongMember = await generateX25519KeyPair()
    const context = {
      teamId: '01JZTEAM000000000000000002',
      memberId: '01JZMEMBER00000000000002',
      keyVersion: 1,
    }
    const wrapped = await wrapTeamKey(await generateTeamKey(), member.publicKey, context)

    await expect(unwrapTeamKey(wrapped, wrongMember, context)).rejects.toThrow()
  })

  it('fails when team key AD context changes', async () => {
    const member = await generateX25519KeyPair()
    const context = {
      teamId: '01JZTEAM000000000000000003',
      memberId: '01JZMEMBER00000000000003',
      keyVersion: 1,
    }
    const wrapped = await wrapTeamKey(await generateTeamKey(), member.publicKey, context)

    await expect(unwrapTeamKey(wrapped, member, { ...context, keyVersion: 2 })).rejects.toThrow()
  })

  it('uses fresh wrapping material and nonces for the same team key', async () => {
    const member = await generateX25519KeyPair()
    const teamKey = await generateTeamKey()
    const context = {
      teamId: '01JZTEAM000000000000000004',
      memberId: '01JZMEMBER00000000000004',
      keyVersion: 4,
    }

    const first = await wrapTeamKey(teamKey, member.publicKey, context)
    const second = await wrapTeamKey(teamKey, member.publicKey, context)

    expect(first.ciphertext).not.toBe(second.ciphertext)
    expect(first.nonce).not.toBe(second.nonce)
  })
})
