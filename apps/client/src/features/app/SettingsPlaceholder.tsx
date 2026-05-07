import { EmptyPlaceholder } from './EmptyPlaceholder'

export function SettingsPlaceholder() {
  return (
    <EmptyPlaceholder
      title="Settings"
      body="Account, security, AI, and connection settings land in Phase 9."
      hint="2FA setup, master-password change, and device management already work via the API."
    />
  )
}
