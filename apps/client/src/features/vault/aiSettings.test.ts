import { describe, expect, it } from 'vitest'
import { secureRandom } from '@trominal/crypto'
import type { VaultRecord } from '@trominal/api-client'
import {
  decryptAiSettings,
  defaultAiSettingsInput,
  encryptAiSettingsInput,
  type AiSettingsInput,
} from './model'

const ID = '01J0AISETTINGS00000000000'

function asRecord(payload: Record<string, unknown>): VaultRecord {
  return {
    id: payload.id as string,
    type: 'ai-settings',
    created_at: '2026-05-08T00:00:00Z',
    updated_at: '2026-05-08T00:00:00Z',
    deleted_at: null,
    ...payload,
  } as VaultRecord
}

describe('AiSettings encrypt/decrypt round-trip', () => {
  it('preserves provider, model, api key, endpoint, and feature toggles', async () => {
    const key = await secureRandom(32)
    const input: AiSettingsInput = {
      provider: 'anthropic',
      endpoint: 'https://api.example.com/v1',
      model: 'claude-sonnet-4-6',
      apiKey: 'sk-secret-token-do-not-leak',
      features: {
        inlineSuggestions: true,
        askPanel: true,
        explainCommand: false,
        sendOutputContext: true,
      },
    }

    const payload = await encryptAiSettingsInput(ID, key, input)
    expect(payload.id).toBe(ID)
    expect(payload.provider_ciphertext).toEqual(expect.any(String))
    expect(payload.api_key_ciphertext).toEqual(expect.any(String))
    expect(payload.settings_ciphertext).toEqual(expect.any(String))

    const decrypted = await decryptAiSettings(asRecord(payload), key)
    expect(decrypted.provider).toBe('anthropic')
    expect(decrypted.endpoint).toBe('https://api.example.com/v1')
    expect(decrypted.model).toBe('claude-sonnet-4-6')
    expect(decrypted.apiKey).toBe('sk-secret-token-do-not-leak')
    expect(decrypted.features).toEqual(input.features)
  })

  it('falls back to default toggles when the settings blob is missing', async () => {
    const key = await secureRandom(32)
    const fallback = defaultAiSettingsInput()
    const payload = await encryptAiSettingsInput(ID, key, fallback)
    // Force the settings ciphertext to look "missing" (as if upgraded from
    // an older row) and confirm we still hand back sensible feature defaults.
    payload.settings_ciphertext = null
    payload.settings_nonce = null
    const decrypted = await decryptAiSettings(asRecord(payload), key)
    expect(decrypted.features).toEqual(fallback.features)
    expect(decrypted.endpoint).toBe('')
  })
})
