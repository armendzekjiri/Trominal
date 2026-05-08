import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  enqueueReducer,
  summarizeTransfers,
  updateById,
  useTransfers,
  type Transfer,
} from './transfersStore'

const SAMPLE: Omit<Transfer, 'status' | 'errorMessage' | 'startedAt' | 'finishedAt'> = {
  id: 'xfer-1',
  direction: 'upload',
  name: 'deploy.sh',
  fromPath: '/home/me/deploy.sh',
  toPath: '/srv/app/deploy.sh',
  hostLabel: 'deploy@web-01',
}

beforeEach(() => {
  useTransfers.setState({ items: [] })
})

afterEach(() => {
  useTransfers.setState({ items: [] })
})

describe('enqueueReducer', () => {
  it('appends a pending transfer with no error/timestamps', () => {
    const next = enqueueReducer({ items: [] }, SAMPLE)
    expect(next.items).toHaveLength(1)
    const item = next.items[0]!
    expect(item.status).toBe('pending')
    expect(item.errorMessage).toBeNull()
    expect(item.startedAt).toBeNull()
    expect(item.finishedAt).toBeNull()
    expect(item.id).toBe('xfer-1')
  })
})

describe('updateById', () => {
  it('only mutates the matching transfer', () => {
    const seeded = enqueueReducer({ items: [] }, SAMPLE)
    const next = updateById(SAMPLE.id, (item) => ({ ...item, status: 'active' }))(seeded)
    expect(next.items[0]!.status).toBe('active')
    const untouched = updateById('does-not-exist', (item) => ({ ...item, status: 'done' }))(seeded)
    expect(untouched.items[0]!.status).toBe('pending')
  })
})

describe('useTransfers actions', () => {
  it('walks pending → active → done', () => {
    useTransfers.getState().enqueue(SAMPLE)
    expect(useTransfers.getState().items[0]!.status).toBe('pending')

    useTransfers.getState().markStarted(SAMPLE.id)
    expect(useTransfers.getState().items[0]!.status).toBe('active')
    expect(useTransfers.getState().items[0]!.startedAt).not.toBeNull()

    useTransfers.getState().markDone(SAMPLE.id)
    const done = useTransfers.getState().items[0]!
    expect(done.status).toBe('done')
    expect(done.finishedAt).not.toBeNull()
  })

  it('records error messages', () => {
    useTransfers.getState().enqueue(SAMPLE)
    useTransfers.getState().markStarted(SAMPLE.id)
    useTransfers.getState().markError(SAMPLE.id, 'permission denied')
    const failed = useTransfers.getState().items[0]!
    expect(failed.status).toBe('error')
    expect(failed.errorMessage).toBe('permission denied')
  })

  it('clear() keeps only in-flight transfers', () => {
    useTransfers.getState().enqueue(SAMPLE)
    useTransfers.getState().enqueue({ ...SAMPLE, id: 'xfer-2', name: 'logs.txt' })
    useTransfers.getState().markStarted('xfer-1')
    useTransfers.getState().markDone('xfer-2')
    useTransfers.getState().clear()
    const remaining = useTransfers.getState().items.map((item) => item.id)
    expect(remaining).toEqual(['xfer-1'])
  })

  it('remove() deletes a single transfer', () => {
    useTransfers.getState().enqueue(SAMPLE)
    useTransfers.getState().enqueue({ ...SAMPLE, id: 'xfer-2' })
    useTransfers.getState().remove('xfer-1')
    expect(useTransfers.getState().items.map((item) => item.id)).toEqual(['xfer-2'])
  })
})

describe('summarizeTransfers', () => {
  it('counts each status bucket', () => {
    const items: Transfer[] = [
      base('a', 'pending'),
      base('b', 'active'),
      base('c', 'active'),
      base('d', 'done'),
      base('e', 'error'),
      base('f', 'cancelled'),
    ]
    expect(summarizeTransfers(items)).toEqual({
      active: 2,
      pending: 1,
      done: 1,
      failed: 2,
    })
  })
})

function base(id: string, status: Transfer['status']): Transfer {
  return {
    id,
    direction: 'upload',
    name: id,
    fromPath: '/from',
    toPath: '/to',
    hostLabel: 'h',
    status,
    errorMessage: status === 'error' ? 'failed' : null,
    startedAt: status === 'pending' ? null : 1,
    finishedAt: status === 'pending' || status === 'active' ? null : 2,
  }
}
