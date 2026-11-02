import { describe, expect, it } from 'vitest'
import { encrypt, makeAd } from '@trominal/crypto'
import { newVaultId } from './ids'
import {
  decryptHost,
  decryptHostCredential,
  decryptSnippet,
  decryptTunnel,
  defaultTunnelConfig,
  encryptHostCredentialInput,
  encryptHostInput,
  encryptHostKeysPayload,
  encryptTunnelInput,
  hostKeysFromString,
  extractVariables,
  substituteVariables,
  tagsFromInput,
} from './model'

describe('vault model helpers', () => {
  it('generates ULIDs for client-bound vault associated data', () => {
    expect(newVaultId(1_778_200_000_000)).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
  })

  it('extracts and substitutes snippet variables', () => {
    const body = 'kubectl logs -n {{ namespace }} -l app={{app}} --tail={{ lines }}'

    expect(extractVariables(body)).toEqual(['namespace', 'app', 'lines'])
    expect(
      substituteVariables(body, {
        namespace: 'prod',
        app: 'api',
        lines: '200',
      }),
    ).toBe('kubectl logs -n prod -l app=api --tail=200')
  })

  it('normalizes comma-separated tags', () => {
    expect(tagsFromInput('prod, web, ,ssh')).toEqual(['prod', 'web', 'ssh'])
  })

  it('round-trips encrypted host credential identity attachments', async () => {
    const key = new Uint8Array(32).fill(7)
    const id = newVaultId(1_778_200_000_000)
    const payload = await encryptHostCredentialInput(id, key, {
      hostId: 'host_01',
      identityId: 'identity_01',
      label: 'prod identity',
      username: '',
      password: '',
      privateKeyPassphrase: '',
    })

    const decrypted = await decryptHostCredential(
      {
        ...payload,
        id,
        type: 'host-credentials',
        created_at: null,
        updated_at: '2026-05-08T00:00:00Z',
        deleted_at: null,
      },
      key,
    )

    expect(decrypted).toMatchObject({
      id,
      hostId: 'host_01',
      identityId: 'identity_01',
      label: 'prod identity',
    })
  })

  it('round-trips encrypted tunnel config', async () => {
    const key = new Uint8Array(32).fill(8)
    const id = newVaultId(1_778_200_000_001)
    const config = {
      ...defaultTunnelConfig(),
      kind: 'local' as const,
      bindPort: '15432',
      targetHost: 'db.internal',
      targetPort: '5432',
    }
    const payload = await encryptTunnelInput(id, key, {
      hostId: 'host_01',
      name: 'prod postgres',
      config,
      enabled: true,
    })

    const decrypted = await decryptTunnel(
      {
        ...payload,
        id,
        type: 'tunnels',
        created_at: null,
        updated_at: '2026-05-08T00:00:00Z',
        deleted_at: null,
      },
      key,
    )

    expect(decrypted).toMatchObject({
      id,
      hostId: 'host_01',
      name: 'prod postgres',
      config,
      enabled: true,
    })
  })

  it('decrypts team resources with team-scoped associated data', async () => {
    const key = new Uint8Array(32).fill(9)
    const id = newVaultId(1_778_200_000_002)
    const teamId = 'team_01'
    const ad = makeAd('team_snippet', `${id}:${teamId}`)
    const title = await encrypt('shared runbook', key, ad)
    const body = await encrypt('systemctl status app', key, ad)

    const decrypted = await decryptSnippet(
      {
        id,
        team_id: teamId,
        type: 'snippets',
        title_ciphertext: title.ct,
        title_nonce: title.n,
        body_ciphertext: body.ct,
        body_nonce: body.n,
        created_at: null,
        updated_at: '2026-05-08T00:00:00Z',
        deleted_at: null,
      },
      key,
    )

    expect(decrypted).toMatchObject({
      id,
      teamId,
      title: 'shared runbook',
      body: 'systemctl status app',
    })
  })

  describe('host key pins', () => {
    const pins = [
      {
        keyType: 'ssh-ed25519',
        publicKey: 'AAAAC3NzaC1lZDI1NTE5AAAAIAJ0zOYsiehXYJEtufsQzfH49rgGwhlP1w6Ub9IZS3b9',
        fingerprint: 'SHA256:cc+OHycpL60Ov6zbIi5p9icXpZtp03nkzYuzTVU/dC4',
        approvedAt: '2026-11-02T00:00:00.000Z',
      },
    ]
    const hostInput = {
      groupId: null,
      name: 'web-01',
      hostname: '10.0.0.1',
      port: '22',
      username: 'deploy',
      tags: [],
      color: '',
    }
    const record = (id: string, payload: Record<string, unknown>) => ({
      ...payload,
      id,
      type: 'hosts' as const,
      created_at: null,
      updated_at: null,
      deleted_at: null,
    })

    it('reads hosts saved before pinning existed as unverified', async () => {
      const key = new Uint8Array(32).fill(9)
      const id = newVaultId(1_778_200_000_010)
      const payload = await encryptHostInput(id, key, hostInput)

      expect(payload).not.toHaveProperty('host_keys_ciphertext')
      const host = await decryptHost(record(id, payload), key)
      expect(host.hostKeys).toEqual([])
      expect(host.hostname).toBe('10.0.0.1')
    })

    it('round-trips approved pins through the encrypted host record', async () => {
      const key = new Uint8Array(32).fill(10)
      const id = newVaultId(1_778_200_000_011)
      const payload = await encryptHostInput(id, key, { ...hostInput, hostKeys: pins })

      expect(typeof payload.host_keys_ciphertext).toBe('string')
      expect(String(payload.host_keys_ciphertext)).not.toContain('ssh-ed25519')
      expect((await decryptHost(record(id, payload), key)).hostKeys).toEqual(pins)
    })

    it('patches only the pins, and an empty list clears them', async () => {
      const key = new Uint8Array(32).fill(11)
      const id = newVaultId(1_778_200_000_012)
      const patch = await encryptHostKeysPayload(id, key, pins)
      expect(Object.keys(patch).sort()).toEqual(['host_keys_ciphertext', 'host_keys_nonce'])

      const cleared = await encryptHostKeysPayload(id, key, [])
      expect(cleared).toEqual({ host_keys_ciphertext: null, host_keys_nonce: null })
    })

    it('binds the pins to the host id', async () => {
      const key = new Uint8Array(32).fill(12)
      const id = newVaultId(1_778_200_000_013)
      const other = newVaultId(1_778_200_000_014)
      const base = await encryptHostInput(other, key, hostInput)
      const stolen = await encryptHostKeysPayload(id, key, pins)

      await expect(decryptHost(record(other, { ...base, ...stolen }), key)).rejects.toThrow()
    })

    it('treats malformed pin data as unverified', () => {
      expect(hostKeysFromString('')).toEqual([])
      expect(hostKeysFromString('not json')).toEqual([])
      expect(hostKeysFromString('{"keyType":"ssh-ed25519"}')).toEqual([])
      expect(hostKeysFromString('[{"keyType":"ssh-ed25519","publicKey":""}]')).toEqual([])
      expect(hostKeysFromString(JSON.stringify(pins))).toEqual(pins)
    })
  })
})
