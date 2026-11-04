import type { TeamReencryptedResource, VaultRecord, VaultRecordPayload } from '@trominal/api-client'
import { decrypt, encrypt, wipe } from '@trominal/crypto'
import { recordAd } from '@/features/vault/model'

export async function rotateTeamRecord(
  record: VaultRecord,
  teamId: string,
  oldKey: Uint8Array,
  newKey: Uint8Array,
): Promise<TeamReencryptedResource> {
  if (record.team_id !== teamId || record.type === 'ai-settings')
    throw new Error('Unexpected team record.')
  const fields: VaultRecordPayload = {}
  const originalFields: VaultRecordPayload = {}
  const ad = recordAd(record, record.type)
  for (const [field, value] of Object.entries(record)) {
    if (!field.endsWith('_ciphertext')) continue
    const nonceField = `${field.slice(0, -'_ciphertext'.length)}_nonce`
    const nonce = record[nonceField]
    if (value == null && nonce == null) continue
    if (typeof value !== 'string' || typeof nonce !== 'string')
      throw new Error('Incomplete encrypted team record.')
    originalFields[field] = value
    originalFields[nonceField] = nonce
    const plaintext = await decrypt({ v: 1, ct: value, n: nonce }, oldKey, ad)
    try {
      const next = await encrypt(plaintext, newKey, ad)
      fields[field] = next.ct
      fields[nonceField] = next.n
    } finally {
      wipe(plaintext)
    }
  }
  for (const [field, value] of Object.entries(record)) {
    if (field.endsWith('_nonce') && value != null && !(field in originalFields))
      throw new Error('Incomplete encrypted team record.')
  }
  return { type: record.type, id: record.id, original_fields: originalFields, fields }
}
