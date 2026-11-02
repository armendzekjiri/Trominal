import { createLocalShellSession, createSshSession, type SshSession } from '@trominal/ssh-transport'
import { getApiClient } from '@/lib/api-client'
import { isTauri } from '@/lib/platform'
import { useHostCredentials, useIdentities } from '@/features/vault/hooks'
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
  const addStoreTab = useTerminalTabs((state) => state.addTab)
  const patchTab = useTerminalTabs((state) => state.patchTab)
  const removeStoreTab = useTerminalTabs((state) => state.removeTab)

  async function hostSession(host: HostItem): Promise<SshSession> {
    const auth = await authForHost(host, hostCredentials, identities)
    const port = Number.parseInt(host.port || '22', 10)

    if (isTauri) {
      return createSshSession({
        hostId: host.id,
        host: host.hostname,
        port,
        username: host.username,
        auth,
        sessionName: host.name,
      })
    }

    const api = await getApiClient()
    const token = await api.createSshToken({ host_id: host.id })

    return createSshSession({
      hostId: host.id,
      host: host.hostname,
      port,
      username: host.username,
      auth,
      websocketUrl: token.websocket_url,
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
      patchTab(tab.id, { session })
      await session.connect()
      patchTab(tab.id, { status: 'connected', session })
    } catch {
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
