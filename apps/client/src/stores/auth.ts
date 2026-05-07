import { create } from 'zustand'
import type { LoginRequest, RegisterRequest, UserDto } from '@trominal/api-client'
import { TrominalApiError } from '@trominal/api-client'
import { getApiClient, resetApiClient } from '@/lib/api-client'
import { secureStorage } from '@/lib/secure-storage'

type AuthState = {
  user: UserDto | null
  accessToken: string | null
  refreshToken: string | null
  isHydrating: boolean
  hydrateError: string | null
}

type AuthActions = {
  /** Read the persisted refresh token and bootstrap a session, if possible. */
  hydrate: () => Promise<void>
  login: (payload: LoginRequest) => Promise<UserDto>
  register: (payload: RegisterRequest) => Promise<UserDto>
  /** Refresh the access token using the persisted refresh token. */
  refresh: () => Promise<boolean>
  fetchMe: () => Promise<UserDto>
  logout: () => Promise<void>
  hasPermission: (slug: string) => boolean
  hasRole: (role: string) => boolean
}

export type AuthStore = AuthState & AuthActions

const initial: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isHydrating: true,
  hydrateError: null,
}

async function applyTokenPair(
  set: (partial: Partial<AuthState>) => void,
  pair: { user: UserDto; access_token: string; refresh_token: string },
): Promise<void> {
  await secureStorage.set('refresh_token', pair.refresh_token)
  const api = await getApiClient()
  api.setAccessToken(pair.access_token)
  set({
    user: pair.user,
    accessToken: pair.access_token,
    refreshToken: pair.refresh_token,
  })
}

/**
 * The server rotates the refresh token on every call to /auth/refresh — using
 * the same token twice rejects the second call with 422. React StrictMode in
 * dev fires effects twice, so two hydrate()s racing each other guaranteed
 * one of them got a 422 and wiped the stored token. Single-flight prevents
 * concurrent /auth/refresh roundtrips from anywhere in the app.
 */
let refreshInflight: Promise<boolean> | null = null
let hydrateInflight: Promise<void> | null = null

/**
 * Distinguish "the server explicitly rejected this token" (clear it; force
 * full re-login) from "we couldn't reach the server / something else broke"
 * (keep the token; let the user retry). Anything else gets the safer
 * keep-the-token behaviour.
 */
function shouldClearTokenOnError(err: unknown): boolean {
  if (err instanceof TrominalApiError) {
    return err.status === 401 || err.status === 422
  }
  return false
}

export const useAuth = create<AuthStore>((set, get) => ({
  ...initial,

  async hydrate() {
    if (hydrateInflight !== null) {
      // Concurrent hydration (StrictMode double-mount, multi-tab focus, etc.)
      // would race for the same single-use refresh token. Coalesce.
      return hydrateInflight
    }
    set({ isHydrating: true, hydrateError: null })
    hydrateInflight = (async (): Promise<void> => {
      try {
        const refreshToken = await secureStorage.get('refresh_token')
        if (refreshToken === null || refreshToken === '') {
          set({ isHydrating: false })
          return
        }
        const api = await getApiClient()
        const pair = await api.refresh({ refresh_token: refreshToken })
        await applyTokenPair(set, pair)
        set({ isHydrating: false })
      } catch (err) {
        if (shouldClearTokenOnError(err)) {
          await secureStorage.delete('refresh_token')
          set({
            ...initial,
            isHydrating: false,
            hydrateError: err instanceof Error ? err.message : 'Session expired',
          })
        } else {
          // Transient: keep the token so a retry can succeed once the issue
          // clears. Just stop showing the splash.
          set({
            isHydrating: false,
            hydrateError: err instanceof Error ? err.message : 'Hydration failed',
          })
        }
      }
    })()
    try {
      await hydrateInflight
    } finally {
      hydrateInflight = null
    }
  },

  async login(payload) {
    const api = await getApiClient()
    const pair = await api.login(payload)
    await applyTokenPair(set, pair)
    return pair.user
  },

  async register(payload) {
    const api = await getApiClient()
    const pair = await api.register(payload)
    await applyTokenPair(set, pair)
    return pair.user
  },

  async refresh() {
    if (refreshInflight !== null) {
      // Same coalescing rationale as hydrate(): the rotation contract on the
      // server makes concurrent refreshes mutually destructive.
      return refreshInflight
    }
    refreshInflight = (async (): Promise<boolean> => {
      const refreshToken = get().refreshToken ?? (await secureStorage.get('refresh_token'))
      if (refreshToken === null || refreshToken === '') {
        return false
      }
      try {
        const api = await getApiClient()
        const pair = await api.refresh({ refresh_token: refreshToken })
        await applyTokenPair(set, pair)
        return true
      } catch (err) {
        if (shouldClearTokenOnError(err)) {
          await get().logout()
        }
        return false
      }
    })()
    try {
      return await refreshInflight
    } finally {
      refreshInflight = null
    }
  },

  async fetchMe() {
    const api = await getApiClient()
    const user = await api.me()
    set({ user })
    return user
  },

  async logout() {
    try {
      const api = await getApiClient()
      await api.logout()
    } catch (err) {
      // Already-revoked tokens / server unreachable — proceed to local cleanup.
      if (!(err instanceof TrominalApiError) && import.meta.env.DEV) {
        console.warn('logout request failed:', err)
      }
    }
    await secureStorage.delete('refresh_token')
    resetApiClient()
    set({ ...initial, isHydrating: false })
  },

  hasPermission(slug) {
    return get().user?.permissions.includes(slug) ?? false
  },

  hasRole(role) {
    return get().user?.roles.includes(role) ?? false
  },
}))
