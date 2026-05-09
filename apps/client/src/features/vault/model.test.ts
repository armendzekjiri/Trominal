import { describe, expect, it } from 'vitest'
import { encrypt, makeAd } from '@trominal/crypto'
import { newVaultId } from './ids'
import {
  decryptHostCredential,
  decryptSnippet,
  decryptTunnel,
  defaultTunnelConfig,
  encryptHostCredentialInput,
  encryptTunnelInput,
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
})
