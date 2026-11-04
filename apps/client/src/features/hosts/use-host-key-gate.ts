import { useMemo } from 'react'
import { isTauri } from '@/lib/platform'
import { useSaveHostKeys } from '@/features/vault/hooks'
import { useVaultActionAccess } from '@/features/vault/access'
import { useTeamScope } from '@/features/teams/store'
import type { HostItem, HostKeyPin } from '@/features/vault/model'
import { useHostKeyPrompt, type HostKeyPromptMode } from './host-key-prompt'
import {
  canPersistPins,
  compareWithPins,
  effectivePins,
  parseHostKeyError,
  pinPayload,
  pinsFromApproval,
  type HostKeyPinPayload,
  type ScannedHostKey,
} from './host-keys'

type TauriCore = {
  invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>
}

type HostKeyHost = Pick<
  HostItem,
  'id' | 'teamId' | 'name' | 'hostname' | 'port' | 'username' | 'hostKeys'
>

export function hostEndpoint(host: Pick<HostItem, 'hostname' | 'port' | 'username'>): string {
  return `${host.username ? `${host.username}@` : ''}${host.hostname}:${host.port || '22'}`
}

function hostPort(host: Pick<HostItem, 'port'>): number {
  const parsed = Number.parseInt(host.port || '22', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 22
}

/** Ask the desktop backend for the server's current host keys. */
export async function scanHostKeys(host: Pick<HostItem, 'hostname' | 'port'>) {
  const { invoke } = (await import('@tauri-apps/api/core')) as TauriCore
  const response = await invoke<{ keys: ScannedHostKey[] }>('ssh_host_key_scan', {
    request: { host: host.hostname, port: hostPort(host) },
  })
  return response.keys
}

/**
 * The one entry point every desktop SSH feature uses before connecting:
 * returns the approved pins to send with the request, asking the user to
 * approve the server's fingerprint first if nothing is approved yet.
 */
export function useHostKeyGate() {
  // mutateAsync is stable, so the returned functions are too (safe in effect deps).
  const { mutateAsync: saveHostKeys } = useSaveHostKeys()
  const canUpdate = useVaultActionAccess()('hosts.update')
  const teamId = useTeamScope((state) => state.selectedTeamId)
  return useMemo(
    () => createHostKeyGate(saveHostKeys, teamId, canUpdate),
    [saveHostKeys, teamId, canUpdate],
  )
}

function createHostKeyGate(
  saveHostKeys: (input: { hostId: string; hostKeys: HostKeyPin[] }) => Promise<unknown>,
  teamId: string | null,
  canUpdate: boolean,
) {
  async function approveAndStore(
    host: HostKeyHost,
    presented: ScannedHostKey[],
    mode: Extract<HostKeyPromptMode, 'approve' | 'replace'>,
    expected: ScannedHostKey[] = [],
  ): Promise<HostKeyPin[] | null> {
    if (presented.length === 0) return null
    const persist = canPersistPins(host, teamId, canUpdate)
    const approved = await useHostKeyPrompt.getState().ask({
      mode,
      hostId: host.id,
      label: host.name || host.hostname,
      endpoint: hostEndpoint(host),
      presented,
      expected,
      sessionOnly: !persist,
    })
    if (!approved) return null
    const pins = pinsFromApproval(presented, new Date())
    if (persist) {
      await saveHostKeys({ hostId: host.id, hostKeys: pins })
    }
    // Open tabs may hold a host snapshot from before the vault refetched.
    useHostKeyPrompt.getState().rememberForSession(host.id, pins)
    return pins
  }

  /**
   * Pins for `host`, or `null` when the user declined. On the web build
   * there is no native SSH, so this is a no-op.
   */
  async function ensureHostKeys(host: HostKeyHost): Promise<HostKeyPinPayload[] | null> {
    const existing = effectivePins(host, useHostKeyPrompt.getState().sessionApprovals)
    if (existing !== null) return pinPayload(existing)
    if (!isTauri) return []
    const presented = await scanHostKeys(host)
    const pins = await approveAndStore(host, presented, 'approve')
    return pins === null ? null : pinPayload(pins)
  }

  /**
   * Show the right dialog for a host-key error from a desktop command.
   * Returns false for any other error so the caller can handle it.
   */
  function handleHostKeyError(error: unknown, host?: HostKeyHost): boolean {
    const problem = parseHostKeyError(error)
    if (problem === null) return false
    if (problem.kind === 'unknown' && host !== undefined) {
      void approveAndStore(host, problem.presented, 'approve')
      return true
    }
    void useHostKeyPrompt.getState().ask({
      mode: 'changed',
      hostId: host?.id ?? null,
      label: host ? host.name || host.hostname : problem.host,
      endpoint: host ? hostEndpoint(host) : `${problem.host}:${problem.port}`,
      presented: problem.presented,
      expected: problem.expected.length > 0 ? problem.expected : (host?.hostKeys ?? []),
      sessionOnly: false,
    })
    return true
  }

  /**
   * Host editor "Verify / Check host key": scan, then either confirm the
   * match, ask for first approval, or require an explicit replacement.
   */
  async function verifyFromEditor(
    host: HostKeyHost,
  ): Promise<'match' | 'approved' | 'replaced' | 'declined'> {
    const presented = await scanHostKeys(host)
    const pins = effectivePins(host, useHostKeyPrompt.getState().sessionApprovals) ?? []
    const state = compareWithPins(pins, presented)
    if (state === 'match') return 'match'
    const stored = await approveAndStore(
      host,
      presented,
      state === 'unpinned' ? 'approve' : 'replace',
      pins,
    )
    if (stored === null) return 'declined'
    return state === 'unpinned' ? 'approved' : 'replaced'
  }

  return { ensureHostKeys, handleHostKeyError, verifyFromEditor }
}
