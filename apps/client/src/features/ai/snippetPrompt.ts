/**
 * Parse the assistant response to a "generate a snippet" prompt into the
 * shape SnippetsPage's form expects.
 *
 * The model is asked for JSON with `{ title, body, tags[] }` but real-world
 * outputs frequently arrive wrapped in a fenced block, prefixed with a
 * sentence, or just plain prose. We try in order:
 *   1. Parse the trimmed response as JSON.
 *   2. Look for a ```json block and parse that.
 *   3. Look for any ``` block and parse that.
 *   4. Fall back: title="Generated snippet", body=raw, no tags.
 *
 * The user always reviews the result before saving, so a permissive
 * fallback is safer than a strict parser that throws on broken JSON.
 */
export type ParsedSnippetSuggestion = {
  title: string
  body: string
  tags: string[]
}

export function parseSnippetSuggestion(raw: string): ParsedSnippetSuggestion {
  const trimmed = raw.trim()
  if (trimmed === '') {
    return { title: 'Generated snippet', body: '', tags: [] }
  }

  const candidates = collectJsonCandidates(trimmed)
  for (const candidate of candidates) {
    const parsed = tryParseSnippet(candidate)
    if (parsed !== null) return parsed
  }

  // No usable JSON — fall back to using the whole response as body.
  return {
    title: 'Generated snippet',
    body: stripCodeFences(trimmed),
    tags: [],
  }
}

function collectJsonCandidates(text: string): string[] {
  const candidates: string[] = [text]
  // ```json blocks first — those are the most reliable signal.
  const jsonFence = /```json\s*([\s\S]*?)```/i.exec(text)
  if (jsonFence !== null && jsonFence[1] !== undefined) {
    candidates.push(jsonFence[1].trim())
  }
  // Then any fenced block.
  const anyFence = /```[a-zA-Z0-9_-]*\s*([\s\S]*?)```/.exec(text)
  if (anyFence !== null && anyFence[1] !== undefined) {
    candidates.push(anyFence[1].trim())
  }
  // Finally a permissive "between the first { and last }" slice.
  const open = text.indexOf('{')
  const close = text.lastIndexOf('}')
  if (open !== -1 && close > open) {
    candidates.push(text.slice(open, close + 1))
  }
  return candidates
}

function tryParseSnippet(value: string): ParsedSnippetSuggestion | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const obj = parsed as Record<string, unknown>
  const title = typeof obj.title === 'string' ? obj.title.trim() : ''
  const body = typeof obj.body === 'string' ? obj.body : ''
  if (title === '' && body === '') return null
  const tags = Array.isArray(obj.tags)
    ? obj.tags
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.trim())
        .filter((t) => t !== '')
    : []
  return {
    title: title || 'Generated snippet',
    body,
    tags,
  }
}

function stripCodeFences(text: string): string {
  const match = /^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```$/.exec(text.trim())
  if (match !== null && match[1] !== undefined) return match[1]
  return text
}

/** Build the prompt the snippet generator sends to the adapter. */
export function buildSnippetPrompt(description: string): string {
  return [
    'Generate a Trominal terminal snippet for this request.',
    '',
    'Reply with strict JSON only (no Markdown, no commentary, no preamble). Schema:',
    '{ "title": string, "body": string, "tags": string[] }',
    '',
    'Body rules:',
    '- A single bash command or short script. Portable bash; mark GNU-only flags only if necessary.',
    '- Use {{name}} placeholders for runtime variables; Trominal substitutes them at run time.',
    '- Never invent flags, paths, or secrets. If a value is unknown, leave a {{placeholder}}.',
    '- No fake `<password>` style placeholders; describe the substitution with a clear name.',
    '- Quote paths that may contain spaces.',
    '',
    'Title: 3-6 words, imperative ("List failed pods"), not a description ("This lists pods").',
    'Tags: 1-4 short lowercase keywords ("k8s", "ops", "git"). No spaces, no leading hashes.',
    '',
    `Request: ${description}`,
  ].join('\n')
}
