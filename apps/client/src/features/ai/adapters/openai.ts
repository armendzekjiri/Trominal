import type { AdapterConfig, AiAdapter, ChatChunk, ChatRequest, ModelInfo } from './types'
import { parseSseStream } from './sse'

// Heuristics that drop OpenAI families which can't take chat-completion
// requests (embeddings, image, audio, moderation). Other providers' lists
// are usually pre-filtered, so this only really fires for openai.com.
const NON_CHAT_KEYWORDS = [
  'embedding',
  'whisper',
  'tts-',
  'dall-e',
  'image',
  'moderation',
  'davinci-002',
  'babbage-002',
] as const

function looksLikeChatModel(id: string): boolean {
  const lower = id.toLowerCase()
  return !NON_CHAT_KEYWORDS.some((keyword) => lower.includes(keyword))
}

const DEFAULT_ENDPOINT = 'https://api.openai.com/v1'
const DEFAULT_MODEL = 'gpt-4o-mini'

/**
 * One adapter for both OpenAI and any OpenAI-compatible server: Ollama,
 * vLLM, OpenRouter, LM Studio, etc. The wire format
 * (`POST /v1/chat/completions` with `{ messages, stream: true }`) is the de
 * facto standard.
 */
export const openAiCompatibleAdapter: AiAdapter = {
  id: 'openai',
  label: 'OpenAI / OpenAI-compatible',
  defaultEndpoint: DEFAULT_ENDPOINT,
  defaultModel: DEFAULT_MODEL,

  async *chat(request: ChatRequest, config: AdapterConfig): AsyncIterable<ChatChunk> {
    const url = joinEndpoint(config.endpoint || DEFAULT_ENDPOINT, '/chat/completions')
    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        signal: request.signal,
        headers: buildHeaders(config),
        body: JSON.stringify({
          model: config.model || DEFAULT_MODEL,
          messages: request.messages,
          temperature: request.temperature,
          max_tokens: request.maxOutputTokens,
          stream: true,
        }),
      })
    } catch (err) {
      yield { kind: 'error', message: err instanceof Error ? err.message : 'Network error' }
      return
    }

    if (!response.ok || response.body === null) {
      yield { kind: 'error', message: await safeErrorMessage(response) }
      return
    }

    let finishReason: string | undefined
    try {
      for await (const event of parseSseStream(response.body, request.signal)) {
        if (event.data === '[DONE]') break
        const payload = parseJson(event.data) as {
          choices?: Array<{
            delta?: { content?: string | null }
            finish_reason?: string | null
          }>
          error?: { message?: string }
        } | null
        if (payload === null) continue
        if (payload.error?.message !== undefined) {
          yield { kind: 'error', message: payload.error.message }
          return
        }
        const choice = payload.choices?.[0]
        const delta = choice?.delta?.content
        if (typeof delta === 'string' && delta !== '') {
          yield { kind: 'text', delta }
        }
        if (typeof choice?.finish_reason === 'string') {
          finishReason = choice.finish_reason
        }
      }
    } catch (err) {
      yield {
        kind: 'error',
        message: err instanceof Error ? err.message : 'Stream interrupted',
      }
      return
    }

    yield { kind: 'done', finishReason }
  },

  async listModels(config: AdapterConfig, signal?: AbortSignal): Promise<ModelInfo[]> {
    const url = joinEndpoint(config.endpoint || DEFAULT_ENDPOINT, '/models')
    const response = await fetch(url, {
      method: 'GET',
      signal,
      headers: buildHeaders(config),
    })
    if (!response.ok) {
      throw new Error(await safeErrorMessage(response))
    }
    const payload = (await response.json()) as { data?: Array<{ id?: unknown }> } | null
    const data = payload?.data ?? []
    return data
      .map((entry) => (typeof entry.id === 'string' ? entry.id : null))
      .filter((id): id is string => id !== null)
      .filter(looksLikeChatModel)
      .sort((a, b) => a.localeCompare(b))
      .map((id) => ({ id }))
  },
}

function buildHeaders(config: AdapterConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  }
  // Ollama and a few other local OpenAI-compatible servers don't require an
  // api key; only set the Authorization header when one was supplied.
  if (config.apiKey.trim() !== '') {
    headers.authorization = `Bearer ${config.apiKey}`
  }
  return headers
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
    const parsed = parseJson(body) as { error?: { message?: string } } | null
    return parsed?.error?.message ?? (body || `${response.status} ${response.statusText}`.trim())
  } catch {
    return `${response.status} ${response.statusText}`.trim()
  }
}
