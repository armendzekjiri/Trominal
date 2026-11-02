import { sftpCancel } from '@/features/sftp/sftpApi'
import { useTransfers } from '@/features/sftp/transfersStore'
import { useTeamScope } from '@/features/teams/store'
import { closeAllTunnelSessions } from '@/features/tunnels/runtime'
import { isTauri } from '@/lib/platform'
import { purgeAllQueries } from '@/lib/query-client'
import { useTerminalTabs } from '@/stores/terminal'
import { useVault } from '@/stores/vault'

/**
 * Tear down everything that belongs to the signed-in account on this server:
 * logout, a rejected refresh token, and switching servers all end here.
 *
 * The secret-bearing state is wiped SYNCHRONOUSLY, before any await, so a slow
 * or hanging network call (the logout request, a native close) can never keep
 * the vault key or decrypted records alive:
 *
 *  1. Vault key + selected team key are zeroed (`lock()`), which also purges
 *     decrypted vault queries and mutation inputs.
 *  2. Team scope, cached vault material and every other cached query go.
 *  3. Terminal tabs close their SSH / local-shell sessions.
 *  4. SFTP transfers are cancelled and the queue emptied.
 *
 * Native tunnels are then stopped asynchronously; the returned promise settles
 * once those close requests have been sent. Never throws.
 *
 * AI chat state lives in component state under the authenticated routes, so it
 * unmounts with them when the guards redirect.
 */
export function teardownSession(): Promise<void> {
  useVault.getState().lock()
  useVault.setState({ material: null, vaultVersion: 0 })
  useTeamScope.getState().setPersonalScope()
  purgeAllQueries()
  useTerminalTabs.getState().resetAll()

  const unfinished = useTransfers
    .getState()
    .items.filter((item) => item.status === 'active' || item.status === 'pending')
  useTransfers.setState({ items: [] })

  const native: Promise<unknown>[] = [closeAllTunnelSessions()]
  if (isTauri) {
    for (const transfer of unfinished) {
      native.push(sftpCancel(transfer.id).catch(() => {}))
    }
  }
  return Promise.allSettled(native).then(() => undefined)
}
