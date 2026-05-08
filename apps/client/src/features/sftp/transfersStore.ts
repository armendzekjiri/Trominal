import { create } from 'zustand'

/**
 * Transfer queue state. We model uploads and downloads in the same list so
 * the bottom transfer panel renders both directions together. The reducer
 * also lives in this file (as plain functions) so we can unit-test it
 * without spinning up a React tree.
 */

export type TransferDirection = 'upload' | 'download'

export type TransferStatus = 'pending' | 'active' | 'done' | 'error' | 'cancelled'

export type Transfer = {
  id: string
  direction: TransferDirection
  name: string
  fromPath: string
  toPath: string
  hostLabel: string
  status: TransferStatus
  errorMessage: string | null
  startedAt: number | null
  finishedAt: number | null
}

export type EnqueueInput = Omit<Transfer, 'status' | 'errorMessage' | 'startedAt' | 'finishedAt'>

type TransfersState = {
  items: Transfer[]
}

type TransfersActions = {
  enqueue: (input: EnqueueInput) => void
  markStarted: (id: string) => void
  markDone: (id: string) => void
  markError: (id: string, message: string) => void
  markCancelled: (id: string) => void
  clear: () => void
  remove: (id: string) => void
}

export type TransfersStore = TransfersState & TransfersActions

export const enqueueReducer = (state: TransfersState, input: EnqueueInput): TransfersState => ({
  items: [
    ...state.items,
    {
      ...input,
      status: 'pending',
      errorMessage: null,
      startedAt: null,
      finishedAt: null,
    },
  ],
})

export const updateById =
  (id: string, patch: (transfer: Transfer) => Transfer) =>
  (state: TransfersState): TransfersState => ({
    items: state.items.map((item) => (item.id === id ? patch(item) : item)),
  })

const now = (): number => Date.now()

const setStatus =
  (status: TransferStatus, extras: Partial<Transfer> = {}) =>
  (transfer: Transfer): Transfer => ({
    ...transfer,
    status,
    ...extras,
  })

export const useTransfers = create<TransfersStore>((set) => ({
  items: [],

  enqueue(input) {
    set((state) => enqueueReducer(state, input))
  },

  markStarted(id) {
    set(updateById(id, setStatus('active', { startedAt: now() })))
  },

  markDone(id) {
    set(updateById(id, setStatus('done', { finishedAt: now() })))
  },

  markError(id, message) {
    set(updateById(id, setStatus('error', { errorMessage: message, finishedAt: now() })))
  },

  markCancelled(id) {
    set(updateById(id, setStatus('cancelled', { finishedAt: now() })))
  },

  clear() {
    set((state) => ({
      items: state.items.filter((item) => item.status === 'active' || item.status === 'pending'),
    }))
  },

  remove(id) {
    set((state) => ({ items: state.items.filter((item) => item.id !== id) }))
  },
}))

export type TransferSummary = {
  active: number
  pending: number
  done: number
  failed: number
}

export function summarizeTransfers(items: ReadonlyArray<Transfer>): TransferSummary {
  const summary: TransferSummary = { active: 0, pending: 0, done: 0, failed: 0 }
  for (const item of items) {
    if (item.status === 'active') summary.active += 1
    else if (item.status === 'pending') summary.pending += 1
    else if (item.status === 'done') summary.done += 1
    else if (item.status === 'error' || item.status === 'cancelled') summary.failed += 1
  }
  return summary
}
