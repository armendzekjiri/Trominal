import { describe, expect, it } from 'vitest'
import { hostCredentialsForHost, latestHostCredentialForHost } from './host-credentials'
import type { HostCredentialItem } from './model'

describe('host credential selection', () => {
  it('selects the newest credential for a host', () => {
    const credentials = [
      credential({ id: 'cred_older', hostId: 'host_1', updatedAt: '2026-01-01T00:00:00Z' }),
      credential({ id: 'cred_other', hostId: 'host_2', updatedAt: '2026-05-01T00:00:00Z' }),
      credential({ id: 'cred_newer', hostId: 'host_1', updatedAt: '2026-02-01T00:00:00Z' }),
    ]

    expect(latestHostCredentialForHost('host_1', credentials)?.id).toBe('cred_newer')
    expect(hostCredentialsForHost('host_1', credentials).map((item) => item.id)).toEqual([
      'cred_newer',
      'cred_older',
    ])
  })

  it('uses ULID/id ordering when timestamps are absent', () => {
    const credentials = [
      credential({ id: '01AAAA', hostId: 'host_1', updatedAt: null }),
      credential({ id: '01BBBB', hostId: 'host_1', updatedAt: null }),
    ]

    expect(latestHostCredentialForHost('host_1', credentials)?.id).toBe('01BBBB')
  })
})

function credential(
  overrides: Pick<HostCredentialItem, 'id' | 'hostId' | 'updatedAt'>,
): HostCredentialItem {
  return {
    id: overrides.id,
    hostId: overrides.hostId,
    identityId: null,
    label: '',
    username: '',
    password: '',
    privateKeyPassphrase: '',
    updatedAt: overrides.updatedAt,
  }
}
