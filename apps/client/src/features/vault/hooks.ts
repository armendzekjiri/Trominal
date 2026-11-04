import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTeamScope } from '@/features/teams/store'
import { getActiveApiBaseUrl, getApiClient } from '@/lib/api-client'
import { useAuth } from '@/stores/auth'
import { useVault } from '@/stores/vault'
import { newVaultId } from './ids'
import { captureVaultWriteScope } from './write-scope'
import {
  decryptAiSettings,
  decryptGroup,
  decryptHost,
  decryptHostCredential,
  decryptIdentity,
  decryptSnippet,
  decryptTunnel,
  encryptAiSettingsInput,
  encryptGroupInput,
  encryptHostCredentialInput,
  encryptHostInput,
  encryptHostKeysPayload,
  encryptIdentityInput,
  encryptSnippetInput,
  encryptTunnelInput,
  type AiSettingsInput,
  type AiSettingsItem,
  type GroupInput,
  type HostCredentialInput,
  type HostInput,
  type HostKeyPin,
  type IdentityInput,
  type SnippetInput,
  type TunnelInput,
} from './model'

function vaultKey(): Uint8Array {
  const key = useVault.getState().key
  if (key === null) {
    throw new Error('Vault is locked.')
  }
  return key
}

/**
 * Cache scope for decrypted vault queries: server URL + user id. Two accounts
 * (or the same id on two servers) never share a cache entry, so a stale hit
 * cannot surface another account's plaintext. Null while signed out.
 */
function useVaultCacheScope(): string | null {
  const userId = useAuth((s) => s.user?.id ?? null)
  if (userId === null) {
    return null
  }
  return `${getActiveApiBaseUrl() ?? ''}#${String(userId)}`
}

function useActiveVaultResourceKey(): Uint8Array | null {
  const personalKey = useVault((s) => s.key)
  const selectedTeamId = useTeamScope((s) => s.selectedTeamId)
  const selectedTeamKey = useTeamScope((s) => s.selectedTeamKey)
  const selectedTeamKeyTeamId = useTeamScope((s) => s.selectedTeamKeyTeamId)

  if (selectedTeamId === null) {
    return personalKey
  }

  return selectedTeamKeyTeamId === selectedTeamId ? selectedTeamKey : null
}

function teamListOptions(teamId: string | null): { teamId: string } | undefined {
  return teamId === null ? undefined : { teamId }
}

const vaultKeys = {
  groupsRoot: ['vault', 'groups'] as const,
  groups: (scope: string | null, teamId: string | null, keyVersion: number | null) =>
    ['vault', 'groups', scope, teamId ?? 'personal', keyVersion ?? 0] as const,
  hostCredentialsRoot: ['vault', 'host-credentials'] as const,
  hostCredentials: (scope: string | null, teamId: string | null, keyVersion: number | null) =>
    ['vault', 'host-credentials', scope, teamId ?? 'personal', keyVersion ?? 0] as const,
  hostsRoot: ['vault', 'hosts'] as const,
  hosts: (scope: string | null, teamId: string | null, keyVersion: number | null) =>
    ['vault', 'hosts', scope, teamId ?? 'personal', keyVersion ?? 0] as const,
  identitiesRoot: ['vault', 'identities'] as const,
  identities: (scope: string | null, teamId: string | null, keyVersion: number | null) =>
    ['vault', 'identities', scope, teamId ?? 'personal', keyVersion ?? 0] as const,
  snippetsRoot: ['vault', 'snippets'] as const,
  snippets: (scope: string | null, teamId: string | null, keyVersion: number | null) =>
    ['vault', 'snippets', scope, teamId ?? 'personal', keyVersion ?? 0] as const,
  tunnelsRoot: ['vault', 'tunnels'] as const,
  tunnels: (scope: string | null, teamId: string | null, keyVersion: number | null) =>
    ['vault', 'tunnels', scope, teamId ?? 'personal', keyVersion ?? 0] as const,
  aiSettingsRoot: ['vault', 'ai-settings'] as const,
  aiSettings: (scope: string | null) => ['vault', 'ai-settings', scope] as const,
}

export function useGroups() {
  const key = useActiveVaultResourceKey()
  const scope = useVaultCacheScope()
  const selectedTeamId = useTeamScope((s) => s.selectedTeamId)
  const selectedTeamKeyVersion = useTeamScope((s) => s.selectedTeamKeyVersion)
  return useQuery({
    queryKey: vaultKeys.groups(
      scope,
      selectedTeamId,
      selectedTeamId === null ? null : selectedTeamKeyVersion,
    ),
    enabled: key !== null && scope !== null,
    queryFn: async () => {
      if (key === null) {
        return []
      }
      const api = await getApiClient()
      const records = await api.listVaultRecords('groups', teamListOptions(selectedTeamId))
      return Promise.all(records.map((record) => decryptGroup(record, key)))
    },
  })
}

export function useHosts() {
  const key = useActiveVaultResourceKey()
  const scope = useVaultCacheScope()
  const selectedTeamId = useTeamScope((s) => s.selectedTeamId)
  const selectedTeamKeyVersion = useTeamScope((s) => s.selectedTeamKeyVersion)
  return useQuery({
    queryKey: vaultKeys.hosts(
      scope,
      selectedTeamId,
      selectedTeamId === null ? null : selectedTeamKeyVersion,
    ),
    enabled: key !== null && scope !== null,
    queryFn: async () => {
      if (key === null) {
        return []
      }
      const api = await getApiClient()
      const records = await api.listVaultRecords('hosts', teamListOptions(selectedTeamId))
      return Promise.all(records.map((record) => decryptHost(record, key)))
    },
  })
}

export function useHostCredentials() {
  const key = useActiveVaultResourceKey()
  const scope = useVaultCacheScope()
  const selectedTeamId = useTeamScope((s) => s.selectedTeamId)
  const selectedTeamKeyVersion = useTeamScope((s) => s.selectedTeamKeyVersion)
  return useQuery({
    queryKey: vaultKeys.hostCredentials(
      scope,
      selectedTeamId,
      selectedTeamId === null ? null : selectedTeamKeyVersion,
    ),
    enabled: key !== null && scope !== null,
    queryFn: async () => {
      if (key === null) {
        return []
      }
      const api = await getApiClient()
      const records = await api.listVaultRecords(
        'host-credentials',
        teamListOptions(selectedTeamId),
      )
      return Promise.all(records.map((record) => decryptHostCredential(record, key)))
    },
  })
}

export function useSnippets() {
  const key = useActiveVaultResourceKey()
  const scope = useVaultCacheScope()
  const selectedTeamId = useTeamScope((s) => s.selectedTeamId)
  const selectedTeamKeyVersion = useTeamScope((s) => s.selectedTeamKeyVersion)
  return useQuery({
    queryKey: vaultKeys.snippets(
      scope,
      selectedTeamId,
      selectedTeamId === null ? null : selectedTeamKeyVersion,
    ),
    enabled: key !== null && scope !== null,
    queryFn: async () => {
      if (key === null) {
        return []
      }
      const api = await getApiClient()
      const records = await api.listVaultRecords('snippets', teamListOptions(selectedTeamId))
      return Promise.all(records.map((record) => decryptSnippet(record, key)))
    },
  })
}

export function useIdentities() {
  const key = useActiveVaultResourceKey()
  const scope = useVaultCacheScope()
  const selectedTeamId = useTeamScope((s) => s.selectedTeamId)
  const selectedTeamKeyVersion = useTeamScope((s) => s.selectedTeamKeyVersion)
  return useQuery({
    queryKey: vaultKeys.identities(
      scope,
      selectedTeamId,
      selectedTeamId === null ? null : selectedTeamKeyVersion,
    ),
    enabled: key !== null && scope !== null,
    queryFn: async () => {
      if (key === null) {
        return []
      }
      const api = await getApiClient()
      const records = await api.listVaultRecords('identities', teamListOptions(selectedTeamId))
      return Promise.all(records.map((record) => decryptIdentity(record, key)))
    },
  })
}

export function useTunnels() {
  const key = useActiveVaultResourceKey()
  const scope = useVaultCacheScope()
  const selectedTeamId = useTeamScope((s) => s.selectedTeamId)
  const selectedTeamKeyVersion = useTeamScope((s) => s.selectedTeamKeyVersion)
  return useQuery({
    queryKey: vaultKeys.tunnels(
      scope,
      selectedTeamId,
      selectedTeamId === null ? null : selectedTeamKeyVersion,
    ),
    enabled: key !== null && scope !== null,
    queryFn: async () => {
      if (key === null) {
        return []
      }
      const api = await getApiClient()
      const records = await api.listVaultRecords('tunnels', teamListOptions(selectedTeamId))
      return Promise.all(records.map((record) => decryptTunnel(record, key)))
    },
  })
}

export function useSaveGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: GroupInput) => {
      const scope = captureVaultWriteScope()
      const id = input.id ?? newVaultId()
      const api = await getApiClient()
      await scope.requireSupported(api)
      const payload = await encryptGroupInput(id, scope.key, input, scope.teamId ?? undefined)
      if (scope.version !== null) payload.team_key_version = scope.version
      scope.assertCurrent()
      return input.id === undefined
        ? api.createVaultRecord('groups', payload)
        : api.updateVaultRecord('groups', id, payload)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.groupsRoot }),
  })
}

export function useSaveHost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: HostInput) => {
      const scope = captureVaultWriteScope()
      const id = input.id ?? newVaultId()
      const api = await getApiClient()
      await scope.requireSupported(api)
      const payload = await encryptHostInput(id, scope.key, input, scope.teamId ?? undefined)
      if (scope.version !== null) payload.team_key_version = scope.version
      scope.assertCurrent()
      return input.id === undefined
        ? api.createVaultRecord('hosts', payload)
        : api.updateVaultRecord('hosts', id, payload)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.hostsRoot }),
  })
}

/**
 * Replace only a host's approved SSH host keys (PATCH of the encrypted
 * `host_keys` field) in the selected workspace.
 */
export function useSaveHostKeys() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ hostId, hostKeys }: { hostId: string; hostKeys: HostKeyPin[] }) => {
      const scope = captureVaultWriteScope()
      const api = await getApiClient()
      await scope.requireSupported(api)
      const payload = await encryptHostKeysPayload(
        hostId,
        scope.key,
        hostKeys,
        scope.teamId ?? undefined,
      )
      if (scope.version !== null) payload.team_key_version = scope.version
      scope.assertCurrent()
      return api.updateVaultRecord('hosts', hostId, payload)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.hostsRoot }),
  })
}

export function useDeleteHost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const scope = captureVaultWriteScope()
      const api = await getApiClient()
      await scope.requireSupported(api)
      const record = await api.getVaultRecord('hosts', id)
      scope.assertCurrent()
      if ((record.team_id ?? null) !== scope.teamId)
        throw new Error('The record belongs to a different workspace.')
      await api.deleteVaultRecord('hosts', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.hostsRoot }),
  })
}

export function useSaveHostCredential() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: HostCredentialInput) => {
      const scope = captureVaultWriteScope()
      const id = input.id ?? newVaultId()
      const api = await getApiClient()
      await scope.requireSupported(api)
      const payload = await encryptHostCredentialInput(
        id,
        scope.key,
        input,
        scope.teamId ?? undefined,
      )
      if (scope.version !== null) payload.team_key_version = scope.version
      scope.assertCurrent()
      return input.id === undefined
        ? api.createVaultRecord('host-credentials', payload)
        : api.updateVaultRecord('host-credentials', id, payload)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.hostCredentialsRoot }),
  })
}

export function useDeleteHostCredential() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const scope = captureVaultWriteScope()
      const api = await getApiClient()
      await scope.requireSupported(api)
      const record = await api.getVaultRecord('host-credentials', id)
      scope.assertCurrent()
      if ((record.team_id ?? null) !== scope.teamId)
        throw new Error('The record belongs to a different workspace.')
      await api.deleteVaultRecord('host-credentials', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.hostCredentialsRoot }),
  })
}

export function useSaveSnippet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SnippetInput) => {
      const scope = captureVaultWriteScope()
      const id = input.id ?? newVaultId()
      const api = await getApiClient()
      await scope.requireSupported(api)
      const payload = await encryptSnippetInput(id, scope.key, input, scope.teamId ?? undefined)
      if (scope.version !== null) payload.team_key_version = scope.version
      scope.assertCurrent()
      return input.id === undefined
        ? api.createVaultRecord('snippets', payload)
        : api.updateVaultRecord('snippets', id, payload)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.snippetsRoot }),
  })
}

export function useDeleteSnippet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const scope = captureVaultWriteScope()
      const api = await getApiClient()
      await scope.requireSupported(api)
      const record = await api.getVaultRecord('snippets', id)
      scope.assertCurrent()
      if ((record.team_id ?? null) !== scope.teamId)
        throw new Error('The record belongs to a different workspace.')
      await api.deleteVaultRecord('snippets', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.snippetsRoot }),
  })
}

export function useSaveIdentity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: IdentityInput) => {
      const scope = captureVaultWriteScope()
      const id = input.id ?? newVaultId()
      const api = await getApiClient()
      await scope.requireSupported(api)
      const payload = await encryptIdentityInput(id, scope.key, input, scope.teamId ?? undefined)
      if (scope.version !== null) payload.team_key_version = scope.version
      scope.assertCurrent()
      return input.id === undefined
        ? api.createVaultRecord('identities', payload)
        : api.updateVaultRecord('identities', id, payload)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.identitiesRoot }),
  })
}

export function useDeleteIdentity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const scope = captureVaultWriteScope()
      const api = await getApiClient()
      await scope.requireSupported(api)
      const record = await api.getVaultRecord('identities', id)
      scope.assertCurrent()
      if ((record.team_id ?? null) !== scope.teamId)
        throw new Error('The record belongs to a different workspace.')
      await api.deleteVaultRecord('identities', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.identitiesRoot }),
  })
}

export function useSaveTunnel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: TunnelInput) => {
      const scope = captureVaultWriteScope()
      const id = input.id ?? newVaultId()
      const api = await getApiClient()
      await scope.requireSupported(api)
      const payload = await encryptTunnelInput(id, scope.key, input, scope.teamId ?? undefined)
      if (scope.version !== null) payload.team_key_version = scope.version
      scope.assertCurrent()
      return input.id === undefined
        ? api.createVaultRecord('tunnels', payload)
        : api.updateVaultRecord('tunnels', id, payload)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.tunnelsRoot }),
  })
}

export function useDeleteTunnel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const scope = captureVaultWriteScope()
      const api = await getApiClient()
      await scope.requireSupported(api)
      const record = await api.getVaultRecord('tunnels', id)
      scope.assertCurrent()
      if ((record.team_id ?? null) !== scope.teamId)
        throw new Error('The record belongs to a different workspace.')
      await api.deleteVaultRecord('tunnels', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.tunnelsRoot }),
  })
}

/**
 * AI settings the features can actually use: saved, with a model picked. Records saved before
 * the model picker existed may have no model and count as not configured.
 */
export function useReadyAiSettings(): AiSettingsItem | null {
  const settings = useAiSettings().data ?? null
  return settings !== null && settings.model.trim() !== '' ? settings : null
}

/**
 * AI settings are a singleton per user (the migration enforces UNIQUE(user_id)),
 * so the list endpoint returns either zero records (never configured) or one.
 * The hook surfaces that as `AiSettingsItem | null` so consumers can branch
 * cleanly without reaching into an array.
 */
export function useAiSettings() {
  const key = useVault((s) => s.key)
  const scope = useVaultCacheScope()
  return useQuery({
    queryKey: vaultKeys.aiSettings(scope),
    enabled: key !== null && scope !== null,
    queryFn: async (): Promise<AiSettingsItem | null> => {
      const api = await getApiClient()
      const records = await api.listVaultRecords('ai-settings')
      if (records.length === 0) {
        return null
      }
      const first = records[0]
      if (first === undefined) {
        return null
      }
      return decryptAiSettings(first, vaultKey())
    },
  })
}

export function useSaveAiSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: AiSettingsInput) => {
      const id = input.id ?? newVaultId()
      const api = await getApiClient()
      const payload = await encryptAiSettingsInput(id, vaultKey(), input)
      return input.id === undefined
        ? api.createVaultRecord('ai-settings', payload)
        : api.updateVaultRecord('ai-settings', id, payload)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.aiSettingsRoot }),
  })
}
