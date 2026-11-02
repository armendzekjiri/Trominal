import { create } from 'zustand'

type Overlay = 'palette' | 'shortcuts' | null

type CommandUiStore = {
  open: Overlay
  show: (overlay: Exclude<Overlay, null>) => void
  toggle: (overlay: Exclude<Overlay, null>) => void
  close: () => void
}

/** Which app-level overlay (command palette or shortcut sheet) is open. One at a time. */
export const useCommandUi = create<CommandUiStore>((set) => ({
  open: null,
  show: (overlay) => set({ open: overlay }),
  toggle: (overlay) => set((state) => ({ open: state.open === overlay ? null : overlay })),
  close: () => set({ open: null }),
}))
