import { describe, expect, it } from 'vitest'
import type { HostKeyPin } from '@/features/vault/model'
import {
  canPersistPins,
  compareWithPins,
  effectivePins,
  keyTypeLabel,
  parseHostKeyError,
  pinPayload,
  pinsFromApproval,
  type ScannedHostKey,
} from './host-keys'

const ED25519: ScannedHostKey = {
  keyType: 'ssh-ed25519',
  publicKey: 'AAAAC3NzaC1lZDI1NTE5AAAAIAJ0zOYsiehXYJEtufsQzfH49rgGwhlP1w6Ub9IZS3b9',
  fingerprint: 'SHA256:cc+OHycpL60Ov6zbIi5p9icXpZtp03nkzYuzTVU/dC4',
}
const OTHER: ScannedHostKey = {
  keyType: 'ssh-ed25519',
  publicKey: 'AAAAC3NzaC1lZDI1NTE5AAAAIB0DWUzzfmsj0qLl7lZVRfhNC1x98nyQCs4PbVsvm0ob',
  fingerprint: 'SHA256:other',
}

function pin(key: ScannedHostKey): HostKeyPin {
  return { ...key, approvedAt: '2026-11-02T00:00:00.000Z' }
}

describe('host key errors', () => {
  it('parses the structured error the desktop commands reject with', () => {
    const error = `trominal-host-key:${JSON.stringify({
      kind: 'changed',
      host: 'example.com',
      port: 2222,
      expected: [ED25519],
      presented: [OTHER],
    })}`

    expect(parseHostKeyError(error)).toEqual({
      kind: 'changed',
      host: 'example.com',
      port: 2222,
      expected: [ED25519],
      presented: [OTHER],
    })
    expect(parseHostKeyError(new Error(`ssh failed: ${error}`))?.kind).toBe('changed')
  })

  it('ignores other errors and malformed payloads', () => {
    expect(parseHostKeyError('Permission denied (publickey).')).toBeNull()
    expect(parseHostKeyError('trominal-host-key:not json')).toBeNull()
    expect(parseHostKeyError('trominal-host-key:{"kind":"accept"}')).toBeNull()
    expect(parseHostKeyError(undefined)).toBeNull()
    expect(
      parseHostKeyError('trominal-host-key:{"kind":"unknown","presented":[{"keyType":1}]}'),
    ).toMatchObject({ kind: 'unknown', presented: [] })
  })
})

describe('host key approval state', () => {
  it('matches only when a presented key was approved', () => {
    expect(compareWithPins([pin(ED25519)], [OTHER, ED25519])).toBe('match')
    expect(compareWithPins([pin(ED25519)], [OTHER])).toBe('changed')
    expect(compareWithPins([pin(ED25519)], [])).toBe('changed')
    expect(compareWithPins([], [ED25519])).toBe('unpinned')
  })

  it('compares the key itself, not just the type or fingerprint text', () => {
    const forged = { ...OTHER, fingerprint: ED25519.fingerprint }
    expect(compareWithPins([pin(ED25519)], [forged])).toBe('changed')
  })

  it('turns an approval into deduplicated, timestamped pins', () => {
    const pins = pinsFromApproval([ED25519, ED25519, OTHER], new Date('2026-11-02T10:00:00Z'))
    expect(pins).toHaveLength(2)
    expect(pins[0]).toEqual({ ...ED25519, approvedAt: '2026-11-02T10:00:00.000Z' })
    expect(pinPayload(pins)).toEqual([
      { keyType: ED25519.keyType, publicKey: ED25519.publicKey },
      { keyType: OTHER.keyType, publicKey: OTHER.publicKey },
    ])
  })

  it('prefers an approval from this session, then the vault, else asks', () => {
    const vaultHost = { id: 'h1', hostKeys: [pin(ED25519)] }
    const freshHost = { id: 'h2', hostKeys: [] }
    expect(effectivePins(vaultHost, {})).toEqual([pin(ED25519)])
    expect(effectivePins(vaultHost, { h1: [pin(OTHER)] })).toEqual([pin(OTHER)])
    expect(effectivePins(freshHost, { h2: [pin(OTHER)] })).toEqual([pin(OTHER)])
    expect(effectivePins(freshHost, {})).toBeNull()
    expect(effectivePins(freshHost, { h2: [] })).toBeNull()
  })

  it('persists pins only when the host belongs to the writable workspace', () => {
    expect(canPersistPins({ teamId: null })).toBe(true)
    expect(canPersistPins({ teamId: 'team_1' })).toBe(false)
    expect(canPersistPins({ teamId: 'team_1' }, 'team_1', true)).toBe(true)
    expect(canPersistPins({ teamId: 'team_1' }, 'team_1', false)).toBe(false)
    expect(canPersistPins({ teamId: null }, 'team_1', true)).toBe(false)
  })

  it('labels key types', () => {
    expect(keyTypeLabel('ssh-ed25519')).toBe('ED25519')
    expect(keyTypeLabel('ecdsa-sha2-nistp256')).toBe('ECDSA')
    expect(keyTypeLabel('ssh-rsa')).toBe('RSA')
    expect(keyTypeLabel('sk-ssh-ed25519@openssh.com')).toBe('ED25519-SK')
  })
})
