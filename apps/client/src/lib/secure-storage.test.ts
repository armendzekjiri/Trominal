import { invoke } from '@tauri-apps/api/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { secureStorage } from './secure-storage'

vi.mock('@/lib/platform', () => ({ isTauri: true, platform: 'desktop' }))
vi.mock('./platform', () => ({ isTauri: true, platform: 'desktop' }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.mocked(invoke).mockClear()
  window.sessionStorage.clear()
  window.localStorage.clear()
})

describe('desktop secure storage', () => {
  it('keeps the refresh token in the OS keychain in production builds', async () => {
    vi.stubEnv('DEV', false)

    await secureStorage.set('refresh_token', 'rt-secret')
    await secureStorage.get('refresh_token')
    await secureStorage.delete('refresh_token')

    expect(invoke).toHaveBeenCalledWith('secure_set', { key: 'refresh_token', value: 'rt-secret' })
    expect(invoke).toHaveBeenCalledWith('secure_get', { key: 'refresh_token' })
    expect(invoke).toHaveBeenCalledWith('secure_delete', { key: 'refresh_token' })
    expect(window.sessionStorage.length).toBe(0)
    expect(window.localStorage.length).toBe(0)
  })

  it('uses tab-scoped web storage for the refresh token only in dev builds', async () => {
    vi.stubEnv('DEV', true)

    await secureStorage.set('refresh_token', 'rt-dev')

    expect(invoke).not.toHaveBeenCalled()
    expect(window.sessionStorage.getItem('trominal:refresh_token')).toBe('rt-dev')
    expect(window.localStorage.getItem('trominal:refresh_token')).toBeNull()
  })

  it('keeps the non-secret server URL in web storage', async () => {
    vi.stubEnv('DEV', false)

    await secureStorage.set('api_base_url', 'https://trominal.example.com')

    expect(invoke).not.toHaveBeenCalled()
    expect(window.localStorage.getItem('trominal:api_base_url')).toBe(
      'https://trominal.example.com',
    )
  })
})
