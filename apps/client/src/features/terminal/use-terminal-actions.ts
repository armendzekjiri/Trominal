import { createLocalShellSession, createSshSession, type SshSession } from '@trominal/ssh-transport'
import { getApiClient } from '@/lib/api-client'
import { requireSecureWebSocketUrl } from '@/lib/server-url'
import { isTauri } from '@/lib/platform'
import { useHostKeyGate } from '@/features/hosts/use-host-key-gate'
import { useHostCredentials, useHosts, useIdentities } from '@/features/vault/hooks'
import type { HostItem } from '@/features/vault/model'
import { authForHost } from '@/features/vault/ssh-auth'
import { useTerminalTabs, type TerminalTab } from '@/stores/terminal'

/**
 * Open, connect and close terminal sessions. Shared by the top bar (session tabs, "+" menu,
 * ⌘T) and the Terminal page (toolbar, ?host= auto-open), so both drive the same store.
 */
export function useTerminalActions() {
  const hostCredentials = useHostCredentials().data ?? []
  const identities = useIdentities().data ?? []
  const hosts = useHosts().data ?? []
  const addStoreTab = useTerminalTabs((state) => state.addTab)
  const patchTab = useTerminalTabs((state) => state.patchTab)
  const removeStoreTab = useTerminalTabs((state) => state.removeTab)
  const { ensureHostKeys, handleHostKeyError } = useHostKeyGate()

  /** `null` when the user declined to trust the server's host key. */
  async function hostSession(host: HostItem): Promise<SshSession | null> {
    const port = Number.parseInt(host.port || '22', 10)

    if (isTauri) {
      // Approve the fingerprint (first use) before any key leaves the vault.
      // Tabs keep a host snapshot, so prefer the freshest vault copy.
      const hostKeys = await ensureHostKeys(hosts.find((item) => item.id === host.id) ?? host)
      if (hostKeys === null) return null
      const auth = await authForHost(host, hostCredentials, identities)
      return createSshSession({
        hostId: host.id,
        host: host.hostname,
        port,
        username: host.username,
        auth,
        hostKeys,
        sessionName: host.name,
      })
    }

    // Web SSH requires a host key pinned in the vault (see probeWebSshHostKey);
    // without one the transport refuses to connect. The web terminal UI is
    // disabled until the pin-approval flow ships.
    const auth = await authForHost(host, hostCredentials, identities)

    const api = await getApiClient()
    const token = await api.createSshToken({ host_id: host.id, host: host.hostname, port })
    requireSecureWebSocketUrl(token.websocket_url)

    return createSshSession({
      hostId: host.id,
      host: host.hostname,
      port,
      username: host.username,
      auth,
      websocketUrl: token.websocket_url,
      websocketToken: token.token,
      sessionName: host.name,
    })
  }

  async function connect(tab: TerminalTab): Promise<void> {
    patchTab(tab.id, { status: 'connecting' })
    try {
      const session =
        tab.kind === 'local'
          ? createLocalShellSession({ sessionName: tab.title })
          : await hostSession(tab.host)
      if (session === null) {
        patchTab(tab.id, { status: 'closed', session: null })
        return
      }
      patchTab(tab.id, { session })
      await session.connect()
      patchTab(tab.id, { status: 'connected', session })
    } catch (error) {
      // A changed or unapproved host key gets its own dialog.
      if (tab.kind === 'host') handleHostKeyError(error, tab.host)
      patchTab(tab.id, { status: 'closed', session: null })
    }
  }

  async function disconnect(tab: TerminalTab): Promise<void> {
    await tab.session?.close()
    patchTab(tab.id, { status: 'closed', session: null })
  }

  function addHostTab(host: HostItem): void {
    const tab: TerminalTab = {
      id: crypto.randomUUID(),
      kind: 'host',
      host,
      status: 'closed',
      session: null,
    }
    addStoreTab(tab)
    void connect(tab)
  }

  function addLocalTab(): void {
    const tab: TerminalTab = {
      id: crypto.randomUUID(),
      kind: 'local',
      title: 'Local shell',
      status: 'closed',
      session: null,
    }
    addStoreTab(tab)
    void connect(tab)
  }

  function closeTab(id: string): void {
    // Read the freshest snapshot so a close mid-render never acts on a stale tab list.
    const tab = useTerminalTabs.getState().tabs.find((item) => item.id === id)
    void tab?.session?.close()
    removeStoreTab(id)
  }

  return { connect, disconnect, addHostTab, addLocalTab, closeTab }
}

export function tabTitle(tab: TerminalTab): string {
  return tab.kind === 'local' ? tab.title : tab.host.name || tab.host.hostname
}

export function statusToDot(status: TerminalTab['status']) {
  if (status === 'connected') return 'connected'
  if (status === 'connecting') return 'connecting'
  return 'disconnected'
}
