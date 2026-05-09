import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTeamScope } from '@/features/teams/store'
import { getApiClient } from '@/lib/api-client'
import { useVault } from '@/stores/vault'
import { newVaultId } from './ids'
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
  encryptIdentityInput,
  encryptSnippetInput,
  encryptTunnelInput,
  type AiSettingsInput,
  type AiSettingsItem,
  type GroupInput,
  type HostCredentialInput,
  type HostInput,
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

function assertPersonalWriteScope(): void {
  if (useTeamScope.getState().selectedTeamId !== null) {
    throw new Error(
      'Team editing is not available yet. Switch to Personal vault to change records.',
    )
  }
}

const vaultKeys = {
  groupsRoot: ['vault', 'groups'] as const,
  groups: (teamId: string | null, keyVersion: number | null) =>
    ['vault', 'groups', teamId ?? 'personal', keyVersion ?? 0] as const,
  hostCredentialsRoot: ['vault', 'host-credentials'] as const,
  hostCredentials: (teamId: string | null, keyVersion: number | null) =>
    ['vault', 'host-credentials', teamId ?? 'personal', keyVersion ?? 0] as const,
  hostsRoot: ['vault', 'hosts'] as const,
  hosts: (teamId: string | null, keyVersion: number | null) =>
    ['vault', 'hosts', teamId ?? 'personal', keyVersion ?? 0] as const,
  identitiesRoot: ['vault', 'identities'] as const,
  identities: (teamId: string | null, keyVersion: number | null) =>
    ['vault', 'identities', teamId ?? 'personal', keyVersion ?? 0] as const,
  snippetsRoot: ['vault', 'snippets'] as const,
  snippets: (teamId: string | null, keyVersion: number | null) =>
    ['vault', 'snippets', teamId ?? 'personal', keyVersion ?? 0] as const,
  tunnelsRoot: ['vault', 'tunnels'] as const,
  tunnels: (teamId: string | null, keyVersion: number | null) =>
    ['vault', 'tunnels', teamId ?? 'personal', keyVersion ?? 0] as const,
  aiSettings: ['vault', 'ai-settings'] as const,
}

export function useGroups() {
  const key = useActiveVaultResourceKey()
  const selectedTeamId = useTeamScope((s) => s.selectedTeamId)
  const selectedTeamKeyVersion = useTeamScope((s) => s.selectedTeamKeyVersion)
  return useQuery({
    queryKey: vaultKeys.groups(
      selectedTeamId,
      selectedTeamId === null ? null : selectedTeamKeyVersion,
    ),
    enabled: key !== null,
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
  const selectedTeamId = useTeamScope((s) => s.selectedTeamId)
  const selectedTeamKeyVersion = useTeamScope((s) => s.selectedTeamKeyVersion)
  return useQuery({
    queryKey: vaultKeys.hosts(
      selectedTeamId,
      selectedTeamId === null ? null : selectedTeamKeyVersion,
    ),
    enabled: key !== null,
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
  const selectedTeamId = useTeamScope((s) => s.selectedTeamId)
  const selectedTeamKeyVersion = useTeamScope((s) => s.selectedTeamKeyVersion)
  return useQuery({
    queryKey: vaultKeys.hostCredentials(
      selectedTeamId,
      selectedTeamId === null ? null : selectedTeamKeyVersion,
    ),
    enabled: key !== null,
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
  const selectedTeamId = useTeamScope((s) => s.selectedTeamId)
  const selectedTeamKeyVersion = useTeamScope((s) => s.selectedTeamKeyVersion)
  return useQuery({
    queryKey: vaultKeys.snippets(
      selectedTeamId,
      selectedTeamId === null ? null : selectedTeamKeyVersion,
    ),
    enabled: key !== null,
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
  const selectedTeamId = useTeamScope((s) => s.selectedTeamId)
  const selectedTeamKeyVersion = useTeamScope((s) => s.selectedTeamKeyVersion)
  return useQuery({
    queryKey: vaultKeys.identities(
      selectedTeamId,
      selectedTeamId === null ? null : selectedTeamKeyVersion,
    ),
    enabled: key !== null,
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
  const selectedTeamId = useTeamScope((s) => s.selectedTeamId)
  const selectedTeamKeyVersion = useTeamScope((s) => s.selectedTeamKeyVersion)
  return useQuery({
    queryKey: vaultKeys.tunnels(
      selectedTeamId,
      selectedTeamId === null ? null : selectedTeamKeyVersion,
    ),
    enabled: key !== null,
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
      assertPersonalWriteScope()
      const id = input.id ?? newVaultId()
      const api = await getApiClient()
      const payload = await encryptGroupInput(id, vaultKey(), input)
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
      assertPersonalWriteScope()
      const id = input.id ?? newVaultId()
      const api = await getApiClient()
      const payload = await encryptHostInput(id, vaultKey(), input)
      return input.id === undefined
        ? api.createVaultRecord('hosts', payload)
        : api.updateVaultRecord('hosts', id, payload)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.hostsRoot }),
  })
}

export function useDeleteHost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      assertPersonalWriteScope()
      const api = await getApiClient()
      await api.deleteVaultRecord('hosts', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.hostsRoot }),
  })
}

export function useSaveHostCredential() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: HostCredentialInput) => {
      assertPersonalWriteScope()
      const id = input.id ?? newVaultId()
      const api = await getApiClient()
      const payload = await encryptHostCredentialInput(id, vaultKey(), input)
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
      assertPersonalWriteScope()
      const api = await getApiClient()
      await api.deleteVaultRecord('host-credentials', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.hostCredentialsRoot }),
  })
}

export function useSaveSnippet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SnippetInput) => {
      assertPersonalWriteScope()
      const id = input.id ?? newVaultId()
      const api = await getApiClient()
      const payload = await encryptSnippetInput(id, vaultKey(), input)
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
      assertPersonalWriteScope()
      const api = await getApiClient()
      await api.deleteVaultRecord('snippets', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.snippetsRoot }),
  })
}

export function useSaveIdentity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: IdentityInput) => {
      assertPersonalWriteScope()
      const id = input.id ?? newVaultId()
      const api = await getApiClient()
      const payload = await encryptIdentityInput(id, vaultKey(), input)
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
      assertPersonalWriteScope()
      const api = await getApiClient()
      await api.deleteVaultRecord('identities', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.identitiesRoot }),
  })
}

export function useSaveTunnel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: TunnelInput) => {
      assertPersonalWriteScope()
      const id = input.id ?? newVaultId()
      const api = await getApiClient()
      const payload = await encryptTunnelInput(id, vaultKey(), input)
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
      assertPersonalWriteScope()
      const api = await getApiClient()
      await api.deleteVaultRecord('tunnels', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.tunnelsRoot }),
  })
}

/**
 * AI settings are a singleton per user (the migration enforces UNIQUE(user_id)),
 * so the list endpoint returns either zero records (never configured) or one.
 * The hook surfaces that as `AiSettingsItem | null` so consumers can branch
 * cleanly without reaching into an array.
 */
export function useAiSettings() {
  const key = useVault((s) => s.key)
  return useQuery({
    queryKey: vaultKeys.aiSettings,
    enabled: key !== null,
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.aiSettings }),
  })
}
