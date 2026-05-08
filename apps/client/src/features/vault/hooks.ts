import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getApiClient } from '@/lib/api-client'
import { useVault } from '@/stores/vault'
import { newVaultId } from './ids'
import {
  decryptGroup,
  decryptHost,
  decryptHostCredential,
  decryptIdentity,
  decryptSnippet,
  encryptGroupInput,
  encryptHostCredentialInput,
  encryptHostInput,
  encryptIdentityInput,
  encryptSnippetInput,
  type GroupInput,
  type HostCredentialInput,
  type HostInput,
  type IdentityInput,
  type SnippetInput,
} from './model'

function vaultKey(): Uint8Array {
  const key = useVault.getState().key
  if (key === null) {
    throw new Error('Vault is locked.')
  }
  return key
}

const vaultKeys = {
  groups: ['vault', 'groups'] as const,
  hostCredentials: ['vault', 'host-credentials'] as const,
  hosts: ['vault', 'hosts'] as const,
  identities: ['vault', 'identities'] as const,
  snippets: ['vault', 'snippets'] as const,
}

export function useGroups() {
  const key = useVault((s) => s.key)
  return useQuery({
    queryKey: vaultKeys.groups,
    enabled: key !== null,
    queryFn: async () => {
      const api = await getApiClient()
      const records = await api.listVaultRecords('groups')
      return Promise.all(records.map((record) => decryptGroup(record, vaultKey())))
    },
  })
}

export function useHosts() {
  const key = useVault((s) => s.key)
  return useQuery({
    queryKey: vaultKeys.hosts,
    enabled: key !== null,
    queryFn: async () => {
      const api = await getApiClient()
      const records = await api.listVaultRecords('hosts')
      return Promise.all(records.map((record) => decryptHost(record, vaultKey())))
    },
  })
}

export function useHostCredentials() {
  const key = useVault((s) => s.key)
  return useQuery({
    queryKey: vaultKeys.hostCredentials,
    enabled: key !== null,
    queryFn: async () => {
      const api = await getApiClient()
      const records = await api.listVaultRecords('host-credentials')
      return Promise.all(records.map((record) => decryptHostCredential(record, vaultKey())))
    },
  })
}

export function useSnippets() {
  const key = useVault((s) => s.key)
  return useQuery({
    queryKey: vaultKeys.snippets,
    enabled: key !== null,
    queryFn: async () => {
      const api = await getApiClient()
      const records = await api.listVaultRecords('snippets')
      return Promise.all(records.map((record) => decryptSnippet(record, vaultKey())))
    },
  })
}

export function useIdentities() {
  const key = useVault((s) => s.key)
  return useQuery({
    queryKey: vaultKeys.identities,
    enabled: key !== null,
    queryFn: async () => {
      const api = await getApiClient()
      const records = await api.listVaultRecords('identities')
      return Promise.all(records.map((record) => decryptIdentity(record, vaultKey())))
    },
  })
}

export function useSaveGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: GroupInput) => {
      const id = input.id ?? newVaultId()
      const api = await getApiClient()
      const payload = await encryptGroupInput(id, vaultKey(), input)
      return input.id === undefined
        ? api.createVaultRecord('groups', payload)
        : api.updateVaultRecord('groups', id, payload)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.groups }),
  })
}

export function useSaveHost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: HostInput) => {
      const id = input.id ?? newVaultId()
      const api = await getApiClient()
      const payload = await encryptHostInput(id, vaultKey(), input)
      return input.id === undefined
        ? api.createVaultRecord('hosts', payload)
        : api.updateVaultRecord('hosts', id, payload)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.hosts }),
  })
}

export function useDeleteHost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const api = await getApiClient()
      await api.deleteVaultRecord('hosts', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.hosts }),
  })
}

export function useSaveHostCredential() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: HostCredentialInput) => {
      const id = input.id ?? newVaultId()
      const api = await getApiClient()
      const payload = await encryptHostCredentialInput(id, vaultKey(), input)
      return input.id === undefined
        ? api.createVaultRecord('host-credentials', payload)
        : api.updateVaultRecord('host-credentials', id, payload)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.hostCredentials }),
  })
}

export function useDeleteHostCredential() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const api = await getApiClient()
      await api.deleteVaultRecord('host-credentials', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.hostCredentials }),
  })
}

export function useSaveSnippet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SnippetInput) => {
      const id = input.id ?? newVaultId()
      const api = await getApiClient()
      const payload = await encryptSnippetInput(id, vaultKey(), input)
      return input.id === undefined
        ? api.createVaultRecord('snippets', payload)
        : api.updateVaultRecord('snippets', id, payload)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.snippets }),
  })
}

export function useDeleteSnippet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const api = await getApiClient()
      await api.deleteVaultRecord('snippets', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.snippets }),
  })
}

export function useSaveIdentity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: IdentityInput) => {
      const id = input.id ?? newVaultId()
      const api = await getApiClient()
      const payload = await encryptIdentityInput(id, vaultKey(), input)
      return input.id === undefined
        ? api.createVaultRecord('identities', payload)
        : api.updateVaultRecord('identities', id, payload)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.identities }),
  })
}

export function useDeleteIdentity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const api = await getApiClient()
      await api.deleteVaultRecord('identities', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.identities }),
  })
}
