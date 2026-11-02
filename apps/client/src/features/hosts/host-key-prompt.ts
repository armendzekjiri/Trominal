import { create } from 'zustand'
import type { HostKeyPin } from '@/features/vault/model'
import type { ScannedHostKey } from './host-keys'

/**
 * - `approve`: first use, the user may trust the presented keys.
 * - `changed`: hard stop after a mismatch; no way to accept from here.
 * - `replace`: explicit re-approval started from the host editor.
 */
export type HostKeyPromptMode = 'approve' | 'changed' | 'replace'

export type HostKeyPrompt = {
  mode: HostKeyPromptMode
  hostId: string | null
  /** Host label for the title line. */
  label: string
  /** `user@host:port`, shown in mono. */
  endpoint: string
  /** Keys the server presents now. */
  presented: ScannedHostKey[]
  /** Keys approved before (changed / replace). */
  expected: ScannedHostKey[]
  /** The approval can't be stored in the vault (team host). */
  sessionOnly: boolean
}

type HostKeyPromptState = {
  prompt: HostKeyPrompt | null
  resolve: ((approved: boolean) => void) | null
  /** Approvals for hosts whose record can't be written, kept until reload. */
  sessionApprovals: Record<string, HostKeyPin[]>
  /** Show the dialog; resolves true only when the user explicitly trusts / replaces. */
  ask: (prompt: HostKeyPrompt) => Promise<boolean>
  answer: (approved: boolean) => void
  rememberForSession: (hostId: string, pins: HostKeyPin[]) => void
}

export const useHostKeyPrompt = create<HostKeyPromptState>((set, get) => ({
  prompt: null,
  resolve: null,
  sessionApprovals: {},
  ask: (prompt) =>
    new Promise<boolean>((resolve) => {
      // A newer prompt replaces an older one; the older one counts as declined.
      get().resolve?.(false)
      set({ prompt, resolve })
    }),
  answer: (approved) => {
    const { resolve, prompt } = get()
    set({ prompt: null, resolve: null })
    // `changed` is informational only and can never resolve as approved.
    resolve?.(approved && prompt !== null && prompt.mode !== 'changed')
  },
  rememberForSession: (hostId, pins) =>
    set((state) => ({ sessionApprovals: { ...state.sessionApprovals, [hostId]: pins } })),
}))
