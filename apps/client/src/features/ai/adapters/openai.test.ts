import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAiCompatibleAdapter } from './openai'

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
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

beforeEach(() => {
  globalThis.fetch = vi.fn() as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
  vi.restoreAllMocks()
})

describe('openAiCompatibleAdapter', () => {
  it('streams text deltas and ends with a done chunk', async () => {
    const fetchSpy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fetchSpy.mockResolvedValueOnce(
      streamingResponse([
        'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" there"},"finish_reason":null}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    )

    const stream = openAiCompatibleAdapter.chat(
      { messages: [{ role: 'user', content: 'hello' }] },
      { endpoint: 'https://api.example.com/v1', model: 'gpt-test', apiKey: 'sk-x' },
    )
    const chunks = []
    for await (const c of stream) chunks.push(c)

    expect(chunks).toEqual([
      { kind: 'text', delta: 'hi' },
      { kind: 'text', delta: ' there' },
      { kind: 'done', finishReason: 'stop' },
    ])

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.example.com/v1/chat/completions')
    const body = JSON.parse(String(init.body))
    expect(body.model).toBe('gpt-test')
    expect(body.stream).toBe(true)
    expect(body.messages).toEqual([{ role: 'user', content: 'hello' }])
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer sk-x')
  })

  it('omits Authorization when no api key is configured (Ollama-style)', async () => {
    const fetchSpy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fetchSpy.mockResolvedValueOnce(streamingResponse(['data: [DONE]\n\n']))

    const stream = openAiCompatibleAdapter.chat(
      { messages: [{ role: 'user', content: 'hi' }] },
      { endpoint: 'http://localhost:11434/v1', model: 'llama3', apiKey: '' },
    )
    for await (const chunk of stream) {
      void chunk
    }

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>).authorization).toBeUndefined()
  })

  it('surfaces provider error JSON as a single error chunk', async () => {
    const fetchSpy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'invalid api key' } }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const stream = openAiCompatibleAdapter.chat(
      { messages: [{ role: 'user', content: 'hi' }] },
      { endpoint: 'https://api.example.com/v1', model: 'gpt-test', apiKey: 'bad' },
    )
    const chunks = []
    for await (const c of stream) chunks.push(c)

    expect(chunks).toEqual([{ kind: 'error', message: 'invalid api key' }])
  })

  describe('listModels', () => {
    it('returns sorted ids and filters out embeddings/audio/image families', async () => {
      const fetchSpy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              { id: 'gpt-4o-mini' },
              { id: 'text-embedding-3-large' },
              { id: 'whisper-1' },
              { id: 'gpt-4o' },
              { id: 'dall-e-3' },
              { id: 'tts-1' },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )

      const models = await openAiCompatibleAdapter.listModels({
        endpoint: 'https://api.example.com/v1',
        model: '',
        apiKey: 'sk-x',
      })

      expect(models.map((entry) => entry.id)).toEqual(['gpt-4o', 'gpt-4o-mini'])
    })

    it('throws on a non-2xx response so the caller can surface the error', async () => {
      const fetchSpy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'invalid api key' } }), { status: 401 }),
      )

      await expect(
        openAiCompatibleAdapter.listModels({
          endpoint: 'https://api.example.com/v1',
          model: '',
          apiKey: 'bad',
        }),
      ).rejects.toThrow('invalid api key')
    })
  })
})
