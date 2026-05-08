import type { AiAdapter } from './types'
import { openAiCompatibleAdapter } from './openai'

/**
 * The "Custom" provider in the Settings UI is for endpoints that mirror the
 * OpenAI chat-completions wire format but live behind a different URL —
 * by far the most common case for self-hosted gateways. We delegate to the
 * OpenAI-compatible adapter and only differ in metadata. If a future provider
 * needs a wholly different protocol, give it its own adapter file rather
 * than overloading this one.
 */
export const customAdapter: AiAdapter = {
  ...openAiCompatibleAdapter,
  id: 'custom',
  label: 'Custom (OpenAI-compatible)',
  defaultEndpoint: '',
  defaultModel: '',
}
