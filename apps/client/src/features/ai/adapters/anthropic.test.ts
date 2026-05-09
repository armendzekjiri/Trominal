import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { anthropicAdapter } from './anthropic'

const ORIGINAL_FETCH = globalThis.fetch

function streamingResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  let index = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close()
        return
      }
      controller.enqueue(encoder.encode(chunks[index] ?? ''))
      index += 1
    },
  })
  return new Response(body, { status: 200 })
}

beforeEach(() => {
  globalThis.fetch = vi.fn() as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
  vi.restoreAllMocks()
})

describe('anthropicAdapter', () => {
  it('extracts text deltas from event-typed Anthropic frames and lifts system prompt', async () => {
    const fetchSpy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fetchSpy.mockResolvedValueOnce(
      streamingResponse([
        'event: content_block_delta\ndata: {"delta":{"type":"text_delta","text":"po"}}\n\n',
        'event: content_block_delta\ndata: {"delta":{"type":"text_delta","text":"ng"}}\n\n',
        'event: message_delta\ndata: {"delta":{"stop_reason":"end_turn"}}\n\n',
        'event: message_stop\ndata: {}\n\n',
      ]),
    )

    const stream = anthropicAdapter.chat(
      {
        messages: [
          { role: 'system', content: 'You ping' },
          { role: 'user', content: 'ping?' },
        ],
      },
      { endpoint: 'https://api.anthropic.com/v1', model: 'claude-x', apiKey: 'sk-x' },
    )
    const chunks = []
    for await (const c of stream) chunks.push(c)

    expect(chunks).toEqual([
      { kind: 'text', delta: 'po' },
      { kind: 'text', delta: 'ng' },
      { kind: 'done', finishReason: 'end_turn' },
    ])

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    const body = JSON.parse(String(init.body))
    expect(body.system).toBe('You ping')
    expect(body.messages).toEqual([{ role: 'user', content: 'ping?' }])
    expect(body.stream).toBe(true)
    const headers = init.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('sk-x')
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true')
  })

  it('translates an `error` event frame into a single error chunk', async () => {
    const fetchSpy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fetchSpy.mockResolvedValueOnce(
      streamingResponse(['event: error\ndata: {"error":{"message":"overloaded"}}\n\n']),
    )

    const stream = anthropicAdapter.chat(
      { messages: [{ role: 'user', content: 'hi' }] },
      { endpoint: 'https://api.anthropic.com/v1', model: 'claude-x', apiKey: 'sk-x' },
    )
    const chunks = []
    for await (const c of stream) chunks.push(c)

    expect(chunks).toEqual([{ kind: 'error', message: 'overloaded' }])
  })

  describe('listModels', () => {
    it('returns ids with the human-friendly display_name as label, newest first', async () => {
      const fetchSpy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              { id: 'claude-3-haiku-20240307', display_name: 'Claude 3 Haiku' },
              { id: 'claude-sonnet-4-6', display_name: 'Claude Sonnet 4.6' },
              { id: 'claude-3-5-sonnet-20240620', display_name: 'Claude 3.5 Sonnet' },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )

      const models = await anthropicAdapter.listModels({
        endpoint: 'https://api.anthropic.com/v1',
        model: '',
        apiKey: 'sk-ant-x',
      })

      expect(models[0]).toEqual({ id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' })
      expect(models.map((entry) => entry.id)).toEqual([
        'claude-sonnet-4-6',
        'claude-3-haiku-20240307',
        'claude-3-5-sonnet-20240620',
      ])
    })

    it('surfaces auth errors instead of swallowing them', async () => {
      const fetchSpy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'authentication_error' } }), {
          status: 401,
        }),
      )

      await expect(
        anthropicAdapter.listModels({
          endpoint: 'https://api.anthropic.com/v1',
          model: '',
          apiKey: 'bad',
        }),
      ).rejects.toThrow('authentication_error')
    })
  })
})
