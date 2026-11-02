import { create } from 'zustand'

/** Per-device layout preferences. Only the sidebar width for now. */

const STORAGE_KEY = 'trominal:layout'

type LayoutStore = {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

function readCollapsed(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return false
    const parsed: unknown = JSON.parse(raw)
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as { sidebarCollapsed?: unknown }).sidebarCollapsed === true
    )
  } catch {
    return false
  }
}

function writeCollapsed(sidebarCollapsed: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ sidebarCollapsed }))
  } catch {
    // Storage blocked (private mode, quota). The preference just won't stick.
  }
}

export const useLayout = create<LayoutStore>((set, get) => ({
  sidebarCollapsed: typeof window === 'undefined' ? false : readCollapsed(),
  toggleSidebar: () => {
    const sidebarCollapsed = !get().sidebarCollapsed
    writeCollapsed(sidebarCollapsed)
    set({ sidebarCollapsed })
  },
}))
