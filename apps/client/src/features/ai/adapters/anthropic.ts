import type { AdapterConfig, AiAdapter, ChatChunk, ChatMessage, ChatRequest } from './types'
import { parseSseStream } from './sse'

const DEFAULT_ENDPOINT = 'https://api.anthropic.com/v1'
const DEFAULT_MODEL = 'claude-sonnet-4-6'
const ANTHROPIC_VERSION = '2023-06-01'

export const anthropicAdapter: AiAdapter = {
  id: 'anthropic',
  label: 'Anthropic',
  defaultEndpoint: DEFAULT_ENDPOINT,
  defaultModel: DEFAULT_MODEL,

  async *chat(request: ChatRequest, config: AdapterConfig): AsyncIterable<ChatChunk> {
    const { systemPrompt, messages } = splitSystemPrompt(request.messages)
    const url = joinEndpoint(config.endpoint || DEFAULT_ENDPOINT, '/messages')
    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        signal: request.signal,
        headers: {
          'content-type': 'application/json',
          // Required to call Anthropic from a browser; the public docs explicitly
          // allow this for first-party clients sending a user-supplied API key.
          'anthropic-dangerous-direct-browser-access': 'true',
          'anthropic-version': ANTHROPIC_VERSION,
          'x-api-key': config.apiKey,
        },
        body: JSON.stringify({
          model: config.model || DEFAULT_MODEL,
          system: systemPrompt,
          messages: messages.map((message) => ({
            role: message.role === 'assistant' ? 'assistant' : 'user',
            content: message.content,
          })),
          max_tokens: request.maxOutputTokens ?? 1024,
          temperature: request.temperature,
          stream: true,
        }),
      })
    } catch (err) {
      yield { kind: 'error', message: err instanceof Error ? err.message : 'Network error' }
      return
    }

    if (!response.ok || response.body === null) {
      const message = await safeErrorMessage(response)
      yield { kind: 'error', message }
      return
    }

    let stopReason: string | undefined
    try {
      for await (const event of parseSseStream(response.body, request.signal)) {
        if (event.data === '[DONE]') break
        const payload = parseJson(event.data)
        if (payload === null) continue
        if (event.event === 'content_block_delta') {
          const delta = (payload as { delta?: { type?: string; text?: string } }).delta
          if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
            yield { kind: 'text', delta: delta.text }
          }
        } else if (event.event === 'message_delta') {
          const delta = (payload as { delta?: { stop_reason?: string } }).delta
          if (typeof delta?.stop_reason === 'string') {
            stopReason = delta.stop_reason
          }
        } else if (event.event === 'message_stop') {
          break
        } else if (event.event === 'error') {
          const message =
            (payload as { error?: { message?: string } }).error?.message ?? 'Anthropic error'
          yield { kind: 'error', message }
          return
        }
      }
    } catch (err) {
      yield {
        kind: 'error',
        message: err instanceof Error ? err.message : 'Stream interrupted',
      }
      return
    }

    yield { kind: 'done', finishReason: stopReason }
  },
}

function splitSystemPrompt(messages: ChatMessage[]): {
  systemPrompt: string | undefined
  messages: ChatMessage[]
} {
  const system = messages.find((message) => message.role === 'system')
  const rest = messages.filter((message) => message.role !== 'system')
  return { systemPrompt: system?.content, messages: rest }
}

function joinEndpoint(base: string, path: string): string {
  const trimmed = base.replace(/\/+$/, '')
  return `${trimmed}${path.startsWith('/') ? path : `/${path}`}`
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

async function safeErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.text()
    const parsed = parseJson(body) as {
      error?: { message?: string; type?: string } | string
    } | null
    if (parsed !== null && typeof parsed === 'object' && parsed !== null) {
      const error = (parsed as { error?: { message?: string } | string }).error
      if (typeof error === 'string') return error
      if (error?.message !== undefined) return error.message
    }
    return body || `${response.status} ${response.statusText}`.trim()
  } catch {
    return `${response.status} ${response.statusText}`.trim()
  }
}
