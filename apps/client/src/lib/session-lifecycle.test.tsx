import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TrominalApiError, type UserDto, type VaultRecord } from '@trominal/api-client'
import type { SshSession } from '@trominal/ssh-transport'
import { useTeamScope } from '@/features/teams/store'
import { useHosts } from '@/features/vault/hooks'
import { encryptHostInput } from '@/features/vault/model'
import { useTransfers } from '@/features/sftp/transfersStore'
import * as apiClientModule from '@/lib/api-client'
import { queryClient } from '@/lib/query-client'
import { secureStorage } from '@/lib/secure-storage'
import { useAuth } from '@/stores/auth'
import { useTerminalTabs } from '@/stores/terminal'
import { useVault } from '@/stores/vault'

type ApiClient = Awaited<ReturnType<typeof apiClientModule.getApiClient>>

function makeUser(id: number, email: string): UserDto {
  return {
    id,
    name: null,
    email,
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
}

function fakeSession(): SshSession & { close: ReturnType<typeof vi.fn> } {
  return {
    id: 'session-1',
    state: 'connected',
    connect: vi.fn(async () => {}),
    write: vi.fn(),
    resize: vi.fn(),
    close: vi.fn(async () => {}),
    onData: vi.fn(() => () => {}),
    onClose: vi.fn(() => () => {}),
  } as unknown as SshSession & { close: ReturnType<typeof vi.fn> }
}

function unlockWith(fill: number): Uint8Array {
  const key = new Uint8Array(32).fill(fill)
  useVault.getState().adoptKey(key)
  return key
}

async function hostRecord(id: string, key: Uint8Array, name: string): Promise<VaultRecord> {
  const payload = await encryptHostInput(id, key, {
    groupId: null,
    name,
    hostname: `${name}.internal`,
    port: '22',
    username: 'root',
    tags: [],
    color: '',
  })
  return {
    ...payload,
    id,
    type: 'hosts',
    created_at: null,
    updated_at: null,
    deleted_at: null,
  } as VaultRecord
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(async () => {
  vi.spyOn(apiClientModule, 'getApiClient').mockResolvedValue({
    logout: vi.fn(async () => {}),
    setAccessToken: vi.fn(),
  } as unknown as ApiClient)
  await useAuth.getState().logout()
  vi.restoreAllMocks()
})

afterEach(() => {
  useVault.getState().lock()
  useTeamScope.getState().setPersonalScope()
  queryClient.clear()
  vi.restoreAllMocks()
})

describe('logout', () => {
  it('wipes the vault key before the network logout settles', async () => {
    let finishLogout: () => void = () => {}
    const networkLogout = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishLogout = resolve
        }),
    )
    vi.spyOn(apiClientModule, 'getApiClient').mockResolvedValue({
      logout: networkLogout,
    } as unknown as ApiClient)
    const key = unlockWith(7)

    const pending = useAuth.getState().logout()

    expect(useVault.getState().isLocked).toBe(true)
    expect(useVault.getState().key).toBeNull()
    expect(Array.from(key).every((byte) => byte === 0)).toBe(true)

    await vi.waitFor(() => expect(networkLogout).toHaveBeenCalled())
    expect(useVault.getState().key).toBeNull()
    finishLogout()
    await pending
  })

  it('removes all cached query data, including decrypted vault records', async () => {
    vi.spyOn(apiClientModule, 'getApiClient').mockResolvedValue({
      logout: vi.fn(async () => {}),
    } as unknown as ApiClient)
    unlockWith(3)
    queryClient.setQueryData(['vault', 'hosts', 'any-scope'], [{ name: 'decrypted' }])
    queryClient.setQueryData(['teams', 'list', '1'], [{ id: 't1' }])

    await useAuth.getState().logout()

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(useVault.getState().material).toBeNull()
  })

  it('closes live terminal sessions and clears the SFTP transfer queue', async () => {
    vi.spyOn(apiClientModule, 'getApiClient').mockResolvedValue({
      logout: vi.fn(async () => {}),
    } as unknown as ApiClient)
    const session = fakeSession()
    useTerminalTabs
      .getState()
      .addTab({ id: 'tab-1', kind: 'local', title: 'zsh', status: 'connected', session })
    useTransfers.getState().enqueue({
      id: 'transfer-1',
      direction: 'upload',
      name: 'a.txt',
      fromPath: '/tmp/a.txt',
      toPath: '/srv/a.txt',
      hostLabel: 'web',
    })

    await useAuth.getState().logout()

    expect(session.close).toHaveBeenCalledTimes(1)
    expect(useTerminalTabs.getState().tabs).toHaveLength(0)
    expect(useTransfers.getState().items).toHaveLength(0)
  })

  it('tears the session down when the server rejects the refresh token', async () => {
    await secureStorage.set('refresh_token', 'revoked')
    vi.spyOn(apiClientModule, 'getApiClient').mockResolvedValue({
      refresh: vi.fn(async () => {
        throw new TrominalApiError(401, '{"message":"revoked"}')
      }),
      logout: vi.fn(async () => {}),
    } as unknown as ApiClient)
    const key = unlockWith(9)
    queryClient.setQueryData(['vault', 'snippets', 'any-scope'], [{ body: 'decrypted' }])

    expect(await useAuth.getState().refresh()).toBe(false)

    expect(Array.from(key).every((byte) => byte === 0)).toBe(true)
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(await secureStorage.get('refresh_token')).toBeNull()
  })
})

describe('vault lock', () => {
  it('removes decrypted vault queries and pending mutation inputs', () => {
    unlockWith(5)
    queryClient.setQueryData(['vault', 'host-credentials', 'any-scope'], [{ password: 'x' }])
    queryClient.setQueryData(['teams', 'list', '1'], [{ id: 't1' }])
    queryClient.getMutationCache().build(queryClient, {
      mutationFn: async (input: { secret: string }) => input,
    }).state.variables = { secret: 'plaintext' }

    useVault.getState().lock()

    expect(queryClient.getQueryCache().findAll({ queryKey: ['vault'] })).toHaveLength(0)
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0)
    // Non-secret, account-scoped data survives a lock (the user is still signed in).
    expect(queryClient.getQueryData(['teams', 'list', '1'])).toEqual([{ id: 't1' }])
  })
})

describe('vault query scoping', () => {
  it('never shows one account’s decrypted records to another account', async () => {
    vi.spyOn(apiClientModule, 'getActiveApiBaseUrl').mockReturnValue('https://one.example')
    const keyA = new Uint8Array(32).fill(1)
    const recordsA = [await hostRecord('01HOSTA0000000000000000000', keyA, 'alpha')]
    const list = vi.fn(async (): Promise<VaultRecord[]> => recordsA)
    vi.spyOn(apiClientModule, 'getApiClient').mockResolvedValue({
      listVaultRecords: list,
    } as unknown as ApiClient)

    useAuth.setState({ user: makeUser(1, 'a@example.com'), accessToken: 'a' })
    useVault.getState().adoptKey(keyA)
    const { result, rerender } = renderHook(() => useHosts(), { wrapper })
    await waitFor(() => expect(result.current.data?.[0]?.name).toBe('alpha'))

    // A different account on the same server: its fetch never settles, so the
    // only way to see data is a stale cache hit from account A.
    list.mockImplementation(() => new Promise<VaultRecord[]>(() => {}))
    act(() => {
      useAuth.setState({ user: makeUser(2, 'b@example.com'), accessToken: 'b' })
      useVault.setState({ key: new Uint8Array(32).fill(2), isLocked: false })
    })
    rerender()

    expect(result.current.data).toBeUndefined()
  })

  it('never shows one server’s decrypted records after switching servers', async () => {
    const baseUrl = vi
      .spyOn(apiClientModule, 'getActiveApiBaseUrl')
      .mockReturnValue('https://one.example')
    const key = new Uint8Array(32).fill(4)
    const list = vi.fn(
      async (): Promise<VaultRecord[]> => [
        await hostRecord('01HOSTB0000000000000000000', key, 'bravo'),
      ],
    )
    vi.spyOn(apiClientModule, 'getApiClient').mockResolvedValue({
      listVaultRecords: list,
    } as unknown as ApiClient)

    useAuth.setState({ user: makeUser(1, 'a@example.com'), accessToken: 'a' })
    useVault.getState().adoptKey(key)
    const { result, rerender } = renderHook(() => useHosts(), { wrapper })
    await waitFor(() => expect(result.current.data?.[0]?.name).toBe('bravo'))

    // Same numeric user id, different server.
    list.mockImplementation(() => new Promise<VaultRecord[]>(() => {}))
    baseUrl.mockReturnValue('https://two.example')
    act(() => {
      useAuth.setState({ user: makeUser(1, 'a@example.com'), accessToken: 'a2' })
    })
    rerender()

    expect(result.current.data).toBeUndefined()
  })
})
