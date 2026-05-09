import type { AiProvider } from '@/features/vault/model'
import type { AiAdapter } from './types'
import { anthropicAdapter } from './anthropic'
import { openAiCompatibleAdapter } from './openai'
import { customAdapter } from './custom'

export type {
  AdapterConfig,
  AiAdapter,
  ChatChunk,
  ChatMessage,
  ChatRequest,
  ChatRole,
  ModelInfo,
} from './types'
export { collectChatText } from './types'

/** Registry of every adapter the Settings UI knows about. */
export const ADAPTERS: Record<AiProvider, AiAdapter> = {
  anthropic: anthropicAdapter,
  openai: openAiCompatibleAdapter,
  ollama: {
    ...openAiCompatibleAdapter,
    id: 'ollama',
    label: 'Ollama (local)',
    defaultEndpoint: 'http://localhost:11434/v1',
    defaultModel: 'llama3',
  },
  custom: customAdapter,
}

export function adapterFor(provider: AiProvider): AiAdapter {
  return ADAPTERS[provider]
}
