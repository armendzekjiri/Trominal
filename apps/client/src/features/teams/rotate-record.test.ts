import { describe, expect, it } from 'vitest'
import { decryptToString, encrypt, makeAd } from '@trominal/crypto'
import { rotateTeamRecord } from './rotate-record'

describe('team record rotation', () => {
  it('re-encrypts all populated fields under a fresh key and preserves the original snapshot', async () => {
    const oldKey = new Uint8Array(32).fill(3)
    const newKey = new Uint8Array(32).fill(4)
    const ad = makeAd('team_host', 'host:team')
    const old = await encrypt('shared host', oldKey, ad)
    const record = {
      id: 'host',
      team_id: 'team',
      type: 'hosts' as const,
      name_ciphertext: old.ct,
      name_nonce: old.n,
      hostname_ciphertext: null,
      hostname_nonce: null,
      created_at: null,
      updated_at: null,
      deleted_at: null,
    }
    const rotated = await rotateTeamRecord(record, 'team', oldKey, newKey)
    expect(rotated.original_fields).toEqual({ name_ciphertext: old.ct, name_nonce: old.n })
    const ct = rotated.fields.name_ciphertext
    const nonce = rotated.fields.name_nonce
    if (typeof ct !== 'string' || typeof nonce !== 'string') throw new Error('Missing ciphertext')
    expect(await decryptToString({ v: 1, ct, n: nonce }, newKey, ad)).toBe('shared host')
    await expect(decryptToString({ v: 1, ct, n: nonce }, oldKey, ad)).rejects.toThrow()
  })

  it('refuses incomplete encrypted fields', async () => {
    const key = new Uint8Array(32).fill(3)
    await expect(
      rotateTeamRecord(
        {
          id: 'host',
          team_id: 'team',
          type: 'hosts',
          name_ciphertext: 'bad',
          name_nonce: null,
          created_at: null,
          updated_at: null,
          deleted_at: null,
        },
        'team',
        key,
        key,
      ),
    ).rejects.toThrow()
  })
})
