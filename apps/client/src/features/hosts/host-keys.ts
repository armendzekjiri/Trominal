import type { HostItem, HostKeyPin } from '@/features/vault/model'

/** A host key as reported by the desktop backend (scan or error payload). */
export type ScannedHostKey = {
  keyType: string
  publicKey: string
  fingerprint: string
}

export type HostKeyProblem = {
  /** `unknown`: nothing approved yet. `changed`: none of the approved keys was presented. */
  kind: 'unknown' | 'changed'
  host: string
  port: number
  expected: ScannedHostKey[]
  presented: ScannedHostKey[]
}

/** What the desktop commands expect in `hostKeys`. */
export type HostKeyPinPayload = { keyType: string; publicKey: string }

/** Must match `HOST_KEY_ERROR_PREFIX` in crates/trominal-core/src/host_keys.rs. */
export const HOST_KEY_ERROR_PREFIX = 'trominal-host-key:'

/**
 * Recognise the structured host-key error the desktop commands return
 * (`trominal-host-key:{json}`), whether it arrives as the raw string Tauri
 * rejects with or wrapped in an Error.
 */
export function parseHostKeyError(error: unknown): HostKeyProblem | null {
  const text =
    typeof error === 'string' ? error : error instanceof Error ? error.message : undefined
  if (text === undefined) return null
  const start = text.indexOf(HOST_KEY_ERROR_PREFIX)
  if (start === -1) return null
  try {
    const parsed = JSON.parse(text.slice(start + HOST_KEY_ERROR_PREFIX.length)) as unknown
    if (typeof parsed !== 'object' || parsed === null) return null
    const value = parsed as Record<string, unknown>
    if (value.kind !== 'unknown' && value.kind !== 'changed') return null
    return {
      kind: value.kind,
      host: typeof value.host === 'string' ? value.host : '',
      port: typeof value.port === 'number' ? value.port : 22,
      expected: scannedKeys(value.expected),
      presented: scannedKeys(value.presented),
    }
  } catch {
    return null
  }
}

function scannedKeys(value: unknown): ScannedHostKey[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): ScannedHostKey[] => {
    if (typeof item !== 'object' || item === null) return []
    const key = item as Record<string, unknown>
    if (
      typeof key.keyType !== 'string' ||
      typeof key.publicKey !== 'string' ||
      typeof key.fingerprint !== 'string'
    ) {
      return []
    }
    return [{ keyType: key.keyType, publicKey: key.publicKey, fingerprint: key.fingerprint }]
  })
}

/** Turn the keys the user just approved into vault pins. */
export function pinsFromApproval(keys: ScannedHostKey[], approvedAt: Date): HostKeyPin[] {
  const seen = new Set<string>()
  return keys.flatMap((key) => {
    const id = `${key.keyType} ${key.publicKey}`
    if (seen.has(id)) return []
    seen.add(id)
    return [{ ...key, approvedAt: approvedAt.toISOString() }]
  })
}

export function pinPayload(pins: HostKeyPin[]): HostKeyPinPayload[] {
  return pins.map(({ keyType, publicKey }) => ({ keyType, publicKey }))
}

/**
 * Compare a fresh scan with the approved keys. `match` needs at least one
 * presented key to be approved; anything else is `changed` (or `unpinned`
 * when nothing was approved yet). Never auto-accepts.
 */
export function compareWithPins(
  pins: HostKeyPin[],
  presented: ScannedHostKey[],
): 'match' | 'changed' | 'unpinned' {
  if (pins.length === 0) return 'unpinned'
  const approved = new Set(pins.map((pin) => `${pin.keyType} ${pin.publicKey}`))
  return presented.some((key) => approved.has(`${key.keyType} ${key.publicKey}`))
    ? 'match'
    : 'changed'
}

/**
 * Pins to use for a connection. An approval made in this app session wins
 * (it is the user's latest decision, and covers team hosts whose record
 * can't be written and host snapshots taken before the vault refetched);
 * otherwise the vault's. `null` means the user has to approve first.
 */
export function effectivePins(
  host: Pick<HostItem, 'id' | 'hostKeys'>,
  sessionApprovals: Readonly<Record<string, HostKeyPin[]>>,
): HostKeyPin[] | null {
  const session = sessionApprovals[host.id]
  if (session !== undefined && session.length > 0) return session
  return host.hostKeys.length > 0 ? host.hostKeys : null
}

/** Persist only in the selected workspace when its role permits updates. */
export function canPersistPins(
  host: Pick<HostItem, 'teamId'>,
  selectedTeamId: string | null = null,
  canUpdate = true,
): boolean {
  return canUpdate && host.teamId === selectedTeamId
}

/** `ssh-ed25519` → `ED25519`, `ecdsa-sha2-nistp256` → `ECDSA`, `ssh-rsa` → `RSA`. */
export function keyTypeLabel(keyType: string): string {
  const type = keyType.toLowerCase()
  if (type.includes('ed25519')) return type.startsWith('sk-') ? 'ED25519-SK' : 'ED25519'
  if (type.includes('ecdsa')) return type.startsWith('sk-') ? 'ECDSA-SK' : 'ECDSA'
  if (type.includes('rsa')) return 'RSA'
  if (type.includes('dss')) return 'DSA'
  return keyType
}
