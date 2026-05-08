import { EmptyPlaceholder } from './EmptyPlaceholder'

export function SftpPlaceholder() {
  return (
    <EmptyPlaceholder
      title="SFTP"
      body="Dual-pane local and remote file transfer is Phase 6B, separate from tunnel management."
      hint="SFTP will use the same encrypted host identities without mixing file operations into the tunnel workflow."
    />
  )
}
