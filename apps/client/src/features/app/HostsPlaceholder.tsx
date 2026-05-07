import { EmptyPlaceholder } from './EmptyPlaceholder'

export function HostsPlaceholder() {
  return (
    <EmptyPlaceholder
      title="Hosts"
      body="The hosts manager (groups, credentials, terminal sessions) lands in Phase 5."
      hint="For now, the foundation around it — auth, vault key, and the design system — is wired up and ready."
    />
  )
}
