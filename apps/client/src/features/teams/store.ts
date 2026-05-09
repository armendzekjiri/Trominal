import { create } from 'zustand'
import { wipe } from '@trominal/crypto'

export type TeamScope = { kind: 'personal' } | { kind: 'team'; teamId: string }

type TeamScopeState = {
  selectedTeamId: string | null
  selectedTeamKey: Uint8Array | null
  selectedTeamKeyTeamId: string | null
  selectedTeamKeyVersion: number | null
  selectedTeamKeyError: string | null
  setPersonalScope: () => void
  setTeamScope: (teamId: string) => void
  setSelectedTeamKey: (teamId: string, keyVersion: number, key: Uint8Array) => void
  setSelectedTeamKeyError: (message: string | null) => void
  clearSelectedTeamKey: () => void
  reconcileTeamIds: (teamIds: readonly string[]) => void
}

function wipeIfPresent(key: Uint8Array | null): void {
  if (key !== null) {
    wipe(key)
  }
}

export const useTeamScope = create<TeamScopeState>((set, get) => ({
  selectedTeamId: null,
  selectedTeamKey: null,
  selectedTeamKeyTeamId: null,
  selectedTeamKeyVersion: null,
  selectedTeamKeyError: null,
  setPersonalScope: () =>
    set((state) => {
      if (
        state.selectedTeamId === null &&
        state.selectedTeamKey === null &&
        state.selectedTeamKeyTeamId === null &&
        state.selectedTeamKeyVersion === null &&
        state.selectedTeamKeyError === null
      ) {
        return state
      }

      wipeIfPresent(state.selectedTeamKey)

      return {
        selectedTeamId: null,
        selectedTeamKey: null,
        selectedTeamKeyTeamId: null,
        selectedTeamKeyVersion: null,
        selectedTeamKeyError: null,
      }
    }),
  setTeamScope: (teamId) =>
    set((state) => {
      if (state.selectedTeamId === teamId) {
        return state
      }

      wipeIfPresent(state.selectedTeamKey)

      return {
        selectedTeamId: teamId,
        selectedTeamKey: null,
        selectedTeamKeyTeamId: null,
        selectedTeamKeyVersion: null,
        selectedTeamKeyError: null,
      }
    }),
  setSelectedTeamKey: (teamId, keyVersion, key) =>
    set((state) => {
      if (
        state.selectedTeamKey === key &&
        state.selectedTeamKeyTeamId === teamId &&
        state.selectedTeamKeyVersion === keyVersion &&
        state.selectedTeamKeyError === null
      ) {
        return state
      }

      if (state.selectedTeamKey !== key) {
        wipeIfPresent(state.selectedTeamKey)
      }

      return {
        selectedTeamKey: key,
        selectedTeamKeyTeamId: teamId,
        selectedTeamKeyVersion: keyVersion,
        selectedTeamKeyError: null,
      }
    }),
  setSelectedTeamKeyError: (message) =>
    set((state) => {
      if (
        state.selectedTeamKey === null &&
        state.selectedTeamKeyTeamId === null &&
        state.selectedTeamKeyVersion === null &&
        state.selectedTeamKeyError === message
      ) {
        return state
      }

      wipeIfPresent(state.selectedTeamKey)

      return {
        selectedTeamKey: null,
        selectedTeamKeyTeamId: null,
        selectedTeamKeyVersion: null,
        selectedTeamKeyError: message,
      }
    }),
  clearSelectedTeamKey: () =>
    set((state) => {
      if (
        state.selectedTeamKey === null &&
        state.selectedTeamKeyTeamId === null &&
        state.selectedTeamKeyVersion === null &&
        state.selectedTeamKeyError === null
      ) {
        return state
      }

      wipeIfPresent(state.selectedTeamKey)

      return {
        selectedTeamKey: null,
        selectedTeamKeyTeamId: null,
        selectedTeamKeyVersion: null,
        selectedTeamKeyError: null,
      }
    }),
  reconcileTeamIds: (teamIds) => {
    const selectedTeamId = get().selectedTeamId

    if (selectedTeamId !== null && !teamIds.includes(selectedTeamId)) {
      get().setPersonalScope()
    }
  },
}))

export function selectedTeamScope(teamId: string | null): TeamScope {
  if (teamId === null) {
    return { kind: 'personal' }
  }

  return { kind: 'team', teamId }
}
