/**
 * The single shape every adapter emits, regardless of whether the upstream
 * provider is OpenAI-compatible, Anthropic Messages, or a custom protocol.
 *
 * Each `chat()` call returns an `AsyncIterable<ChatChunk>` so the UI can
 * stream tokens straight to the screen and surface failures inline without
 * waiting for the whole response.
 */
export type ChatRole = 'system' | 'user' | 'assistant'

export type ChatMessage = {
  role: ChatRole
  content: string
}

export type ChatChunk =
  | { kind: 'text'; delta: string }
  | { kind: 'done'; finishReason?: string }
  | { kind: 'error'; message: string }

export type ChatRequest = {
  messages: ChatMessage[]
  /** Soft caps on output length / sampling. Adapters apply sane defaults if absent. */
  maxOutputTokens?: number
  temperature?: number
  /** Abort the in-flight request — adapters wire this through to fetch(). */
  signal?: AbortSignal
}

/**
 * The active AI configuration the adapter needs to run. Pulled out of the
 * vault, so the api key is plaintext only in memory and only as long as the
 * request takes.
 */
export type AdapterConfig = {
  endpoint: string
  model: string
  apiKey: string
}

export interface AiAdapter {
  /** Stable id matching the AiProvider enum, for telemetry / errors. */
  readonly id: string
  /** Human-readable label for the Settings UI. */
  readonly label: string
  /** Default endpoint when the user hasn't typed one. */
  readonly defaultEndpoint: string
  /** The first suggestion in the model picker. */
  readonly defaultModel: string

  /**
   * Stream a chat response. The implementation is expected to:
   * - emit one or more `text` chunks
   * - finish with exactly one `done` (success) or one `error` chunk
   * - honour `request.signal` for cancellation
   */
  chat(request: ChatRequest, config: AdapterConfig): AsyncIterable<ChatChunk>
}

/**
 * Walk an AsyncIterable<ChatChunk> and return the concatenated text once the
 * stream finishes. Used by `Test connection` and any non-streaming caller.
 * Throws if the stream emits an `error` chunk.
 */
export async function collectChatText(stream: AsyncIterable<ChatChunk>): Promise<string> {
  let buffer = ''
  for await (const chunk of stream) {
    if (chunk.kind === 'text') {
      buffer += chunk.delta
    } else if (chunk.kind === 'error') {
      throw new Error(chunk.message)
    }
  }
  return buffer
}
