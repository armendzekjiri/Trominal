import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TrominalApiError, type TokenPairResponse, type UserDto } from '@trominal/api-client'
import { secureStorage } from '@/lib/secure-storage'
import * as apiClientModule from '@/lib/api-client'
import { useAuth } from './auth'

const FAKE_USER: UserDto = {
  id: 1,
  name: 'Test',
  email: 'test@example.com',
  roles: ['user'],
  permissions: [],
  vault: {
    kdf_salt: 'salt',
    kdf_params: {
      version: 1,
      alg: 'argon2id',
      memlimit: 67108864,
      opslimit: 3,
      salt_len: 16,
      out_len: 32,
    },
    public_key: 'pk',
    private_key_ciphertext: 'pkc',
    private_key_nonce: 'pkn',
  },
  two_factor_enabled: false,
  suspended_at: null,
  created_at: null,
  updated_at: null,
}

function makePair(refresh: string): TokenPairResponse {
  return {
    user: FAKE_USER,
    access_token: `access-for-${refresh}`,
    refresh_token: refresh,
    token_type: 'Bearer',
    expires_in: 900,
  }
}

beforeEach(async () => {
  await secureStorage.delete('refresh_token')
  // Reset the auth store to its initial shape between tests.
  await useAuth.getState().logout()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('auth store hydrate()', () => {
  it('coalesces concurrent hydrations into one /auth/refresh call', async () => {
    await secureStorage.set('refresh_token', 'one-shot-token')

    const refresh = vi.fn(async (payload: { refresh_token: string }) => {
      // Simulate the server's rotation: any second call with the same token
      // would 422. We assert it's never called twice.
      if (payload.refresh_token !== 'one-shot-token') {
        throw new TrominalApiError(422, '{"errors":{"refresh_token":["invalid"]}}')
      }
      return makePair('rotated-token-1')
    })
    vi.spyOn(apiClientModule, 'getApiClient').mockResolvedValue({
      refresh,
      setAccessToken: vi.fn(),
      logout: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof apiClientModule.getApiClient>>)

    const a = useAuth.getState().hydrate()
    const b = useAuth.getState().hydrate()
    await Promise.all([a, b])

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(useAuth.getState().accessToken).toBe('access-for-rotated-token-1')
    expect(await secureStorage.get('refresh_token')).toBe('rotated-token-1')
  })

  it('keeps the stored token on transient (non-422/401) failures', async () => {
    await secureStorage.set('refresh_token', 'still-good')
    vi.spyOn(apiClientModule, 'getApiClient').mockResolvedValue({
      refresh: vi.fn(async () => {
        throw new Error('network down')
      }),
      setAccessToken: vi.fn(),
      logout: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof apiClientModule.getApiClient>>)

    await useAuth.getState().hydrate()

    expect(useAuth.getState().isHydrating).toBe(false)
    expect(useAuth.getState().hydrateError).toContain('network down')
    expect(await secureStorage.get('refresh_token')).toBe('still-good')
  })

  it('clears the stored token when the server explicitly rejects it', async () => {
    await secureStorage.set('refresh_token', 'expired')
    vi.spyOn(apiClientModule, 'getApiClient').mockResolvedValue({
      refresh: vi.fn(async () => {
        throw new TrominalApiError(422, '{"errors":{"refresh_token":["invalid"]}}')
      }),
      setAccessToken: vi.fn(),
      logout: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof apiClientModule.getApiClient>>)

    await useAuth.getState().hydrate()

    expect(useAuth.getState().accessToken).toBeNull()
    expect(await secureStorage.get('refresh_token')).toBeNull()
  })

  it('does nothing when no refresh token is stored', async () => {
    const refresh = vi.fn()
    vi.spyOn(apiClientModule, 'getApiClient').mockResolvedValue({
      refresh,
      setAccessToken: vi.fn(),
      logout: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof apiClientModule.getApiClient>>)

    await useAuth.getState().hydrate()

    expect(refresh).not.toHaveBeenCalled()
    expect(useAuth.getState().isHydrating).toBe(false)
  })
})
