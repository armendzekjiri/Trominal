import { useEffect, useMemo } from 'react'
import { Building2, ChevronDown, Loader2 } from 'lucide-react'
import { wipe } from '@trominal/crypto'

import { getApiClient } from '@/lib/api-client'
import { cn } from '@/lib/cn'
import { useAuth } from '@/stores/auth'
import { useVault } from '@/stores/vault'
import { unwrapTeamKeyForTeam, useTeamSummaries, type TeamSummary } from './api'
import { useTeamScope } from './store'

const PERSONAL_SCOPE = 'personal'
const EMPTY_TEAMS: TeamSummary[] = []

export function TeamScopeSwitcher() {
  const selectedTeamId = useTeamScope((state) => state.selectedTeamId)
  const selectedTeamKeyTeamId = useTeamScope((state) => state.selectedTeamKeyTeamId)
  const selectedTeamKeyVersion = useTeamScope((state) => state.selectedTeamKeyVersion)
  const selectedTeamKeyError = useTeamScope((state) => state.selectedTeamKeyError)
  const setPersonalScope = useTeamScope((state) => state.setPersonalScope)
  const setTeamScope = useTeamScope((state) => state.setTeamScope)
  const setSelectedTeamKey = useTeamScope((state) => state.setSelectedTeamKey)
  const setSelectedTeamKeyError = useTeamScope((state) => state.setSelectedTeamKeyError)
  const clearSelectedTeamKey = useTeamScope((state) => state.clearSelectedTeamKey)
  const reconcileTeamIds = useTeamScope((state) => state.reconcileTeamIds)
  const user = useAuth((state) => state.user)
  const vaultKey = useVault((state) => state.key)
  const teamsQuery = useTeamSummaries()
  const teams = teamsQuery.data ?? EMPTY_TEAMS
  const teamIds = useMemo(() => teams.map((team) => team.id), [teams])
  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? null

  useEffect(() => {
    reconcileTeamIds(teamIds)
  }, [reconcileTeamIds, teamIds])

  useEffect(() => {
    if (selectedTeamId === null) {
      clearSelectedTeamKey()
      return
    }

    if (vaultKey === null || user === null) {
      clearSelectedTeamKey()
      return
    }

    if (
      selectedTeamKeyTeamId === selectedTeamId &&
      selectedTeamKeyVersion !== null &&
      (selectedTeam === null || selectedTeamKeyVersion === selectedTeam.keyVersion)
    ) {
      return
    }

    let cancelled = false
    let loadedKey: Uint8Array | null = null
    const teamIdToLoad = selectedTeamId
    const userToLoad = user
    const vaultKeyToUse = vaultKey
    setSelectedTeamKeyError(null)

    async function loadTeamKey(): Promise<void> {
      try {
        const api = await getApiClient()
        const team = await api.getTeam(teamIdToLoad)
        loadedKey = await unwrapTeamKeyForTeam(team, userToLoad, vaultKeyToUse)

        if (cancelled) {
          wipe(loadedKey)
          loadedKey = null
          return
        }

        setSelectedTeamKey(team.id, team.key_version, loadedKey)
        loadedKey = null
      } catch {
        if (!cancelled) {
          setSelectedTeamKeyError('Team key could not be unlocked.')
        }
      }
    }

    void loadTeamKey()

    return () => {
      cancelled = true

      if (loadedKey !== null) {
        wipe(loadedKey)
      }
    }
  }, [
    clearSelectedTeamKey,
    selectedTeam,
    selectedTeamId,
    selectedTeamKeyTeamId,
    selectedTeamKeyVersion,
    setSelectedTeamKey,
    setSelectedTeamKeyError,
    user,
    vaultKey,
  ])

  return (
    <div className="px-2">
      <label
        htmlFor="team-scope"
        className="mb-1 flex items-center gap-1.5 text-[10px] uppercase text-fg-faint"
      >
        <Building2 size={12} />
        Workspace
      </label>
      <div className="relative">
        {teamsQuery.isFetching ? (
          <Loader2
            aria-hidden="true"
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-fg-faint"
          />
        ) : (
          <Building2
            aria-hidden="true"
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-faint"
          />
        )}
        <select
          id="team-scope"
          value={selectedTeamId ?? PERSONAL_SCOPE}
          onChange={(event) => {
            if (event.target.value === PERSONAL_SCOPE) {
              setPersonalScope()
              return
            }

            setTeamScope(event.target.value)
          }}
          className={cn(
            'h-9 w-full appearance-none rounded-sm border border-border-subtle bg-surface py-1 pl-7 pr-7 text-[12px] text-fg outline-none transition-colors',
            'hover:border-border focus:border-accent',
          )}
          aria-label="Workspace"
        >
          <option value={PERSONAL_SCOPE}>Personal vault</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.decryptable ? team.name : `${team.name} (locked)`}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-faint"
        />
      </div>
      {selectedTeam !== null && (
        <div className="mt-1 truncate text-[10px] text-fg-faint">
          {selectedTeam.role} - key v{selectedTeam.keyVersion}
        </div>
      )}
      {selectedTeamKeyError !== null && (
        <div className="mt-1 truncate text-[10px] text-danger">{selectedTeamKeyError}</div>
      )}
    </div>
  )
}
