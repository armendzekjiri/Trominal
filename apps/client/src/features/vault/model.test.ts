import { describe, expect, it } from 'vitest'
import { newVaultId } from './ids'
import {
  decryptHostCredential,
  encryptHostCredentialInput,
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
})
