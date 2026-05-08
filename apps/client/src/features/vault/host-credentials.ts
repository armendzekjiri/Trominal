import type { HostCredentialItem } from './model'

export function latestHostCredentialForHost(
  hostId: string,
  credentials: HostCredentialItem[],
): HostCredentialItem | null {
  return hostCredentialsForHost(hostId, credentials)[0] ?? null
}

export function hostCredentialsForHost(
  hostId: string,
  credentials: HostCredentialItem[],
): HostCredentialItem[] {
  return credentials
    .filter((credential) => credential.hostId === hostId)
    .sort(compareCredentialRecency)
}

function compareCredentialRecency(a: HostCredentialItem, b: HostCredentialItem): number {
  const updatedDelta = timestampMs(b.updatedAt) - timestampMs(a.updatedAt)
  if (updatedDelta !== 0) {
    return updatedDelta
  }

  return b.id.localeCompare(a.id)
}

function timestampMs(value: string | null): number {
  const parsed = Date.parse(value ?? '')
  return Number.isFinite(parsed) ? parsed : 0
}
