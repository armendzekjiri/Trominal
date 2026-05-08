import { describe, expect, it } from 'vitest'
import { parseSseStream } from './sse'

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let index = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close()
        return
      }
      controller.enqueue(encoder.encode(chunks[index] ?? ''))
      index += 1
    },
  })
}

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = []
  for await (const value of iter) {
    out.push(value)
  }
  return out
}

describe('parseSseStream', () => {
  it('parses single-event frames split into one chunk', async () => {
    const stream = streamFromChunks(['event: message\ndata: hello\n\n'])
    const events = await collect(parseSseStream(stream))
    expect(events).toEqual([{ event: 'message', data: 'hello' }])
  })

  it('parses frames split across multiple network chunks', async () => {
    const stream = streamFromChunks([
      'event: content_block_delta\ndata: {"d',
      'elta": {"type": "text_delta", "text": "hi"}}\n',
      '\nevent: done\ndata: ok\n\n',
    ])
    const events = await collect(parseSseStream(stream))
    expect(events).toEqual([
      { event: 'content_block_delta', data: '{"delta": {"type": "text_delta", "text": "hi"}}' },
      { event: 'done', data: 'ok' },
    ])
  })

  it('joins multi-line `data:` fields with a literal newline', async () => {
    const stream = streamFromChunks(['data: line one\ndata: line two\n\n'])
    const events = await collect(parseSseStream(stream))
    expect(events).toEqual([{ event: 'message', data: 'line one\nline two' }])
  })

  it('drops keepalive comment lines without producing events', async () => {
    const stream = streamFromChunks([': keepalive\ndata: real\n\n'])
    const events = await collect(parseSseStream(stream))
    expect(events).toEqual([{ event: 'message', data: 'real' }])
  })
})
