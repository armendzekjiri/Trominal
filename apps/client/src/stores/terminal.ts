import type { SshSession } from '@trominal/ssh-transport'
import { create } from 'zustand'
import type { HostItem } from '@/features/vault/model'

/**
 * Terminal tabs and their live SSH/local-shell sessions live in this store
 * (instead of `TerminalPage` local state) so they survive route changes.
 * Without this, navigating from /terminal → /hosts → /terminal would
 * unmount the page, drop the React state, and leave the user with an empty
 * tab bar (and dangling Tauri-side PTY children with no JS handle).
 *
 * Sessions are JS objects that wrap a Tauri command surface; the underlying
 * PTY child stays alive in Rust as long as nothing calls `session.close()`.
 * On remount xterm rebuilds a fresh Terminal and re-subscribes to
 * `session.onData` via XtermPane, so output streams resume into the new
 * terminal instance.
 */

type BaseTerminalTab = {
  id: string
  status: 'closed' | 'connected' | 'connecting'
  session: SshSession | null
}

export type TerminalTab =
  | (BaseTerminalTab & { kind: 'host'; host: HostItem })
  | (BaseTerminalTab & { kind: 'local'; title: string })

type PatchableTabFields = {
  status?: TerminalTab['status']
  session?: SshSession | null
}

type TerminalState = {
  tabs: TerminalTab[]
  activeId: string | null
}

type TerminalActions = {
  setActive: (id: string | null) => void
  addTab: (tab: TerminalTab) => void
  patchTab: (id: string, patch: PatchableTabFields) => void
  /** Remove a tab, picking another active id if the removed one was active. */
  removeTab: (id: string) => void
  /**
   * Close every live session and drop all tabs. Used on logout and server
   * switch so no SSH / local-shell process outlives the signed-in account.
   */
  resetAll: () => void
}

export type TerminalStore = TerminalState & TerminalActions

const initial: TerminalState = {
  tabs: [],
  activeId: null,
}

export const useTerminalTabs = create<TerminalStore>((set, get) => ({
  ...initial,
  setActive: (id) => set({ activeId: id }),
  addTab: (tab) =>
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeId: tab.id,
    })),
  patchTab: (id, patch) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)),
    })),
  removeTab: (id) =>
    set((state) => {
      const tabs = state.tabs.filter((tab) => tab.id !== id)
      const activeId = state.activeId === id ? (tabs[0]?.id ?? null) : state.activeId
      return { tabs, activeId }
    }),
  resetAll: () => {
    const sessions = get().tabs.flatMap((tab) => (tab.session === null ? [] : [tab.session]))
    set(initial)
    for (const session of sessions) {
      // Fire-and-forget: a session that is already gone must not block teardown.
      void Promise.resolve()
        .then(() => session.close())
        .catch(() => {})
    }
  },
}))
