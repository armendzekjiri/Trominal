/**
 * Minimal Server-Sent Events parser tuned for the streaming bodies that
 * OpenAI and Anthropic send for chat completions.
 *
 * Both providers emit `data: <json>\n\n` frames; OpenAI also sends a
 * sentinel `data: [DONE]` and Anthropic uses event-typed frames. We don't
 * try to be a general SSE library — just enough to peel the `data:` payload
 * out of a Response body so each adapter can route it.
 */
export type SseEvent = { event: string; data: string }

export async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncIterable<SseEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  try {
    while (true) {
      if (signal?.aborted === true) {
        await reader.cancel('aborted').catch(() => undefined)
        return
      }
      const { value, done } = await reader.read()
      if (done) {
        const flushed = flushFrame(buffer)
        if (flushed !== null) yield flushed
        return
      }
      buffer += decoder.decode(value, { stream: true })
      let separator = buffer.indexOf('\n\n')
      while (separator !== -1) {
        const frame = buffer.slice(0, separator)
        buffer = buffer.slice(separator + 2)
        const parsed = parseFrame(frame)
        if (parsed !== null) yield parsed
        separator = buffer.indexOf('\n\n')
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function flushFrame(remainder: string): SseEvent | null {
  if (remainder.trim() === '') return null
  return parseFrame(remainder)
}

function parseFrame(raw: string): SseEvent | null {
  let event = 'message'
  const dataLines: string[] = []
  for (const line of raw.split('\n')) {
    const cleaned = line.endsWith('\r') ? line.slice(0, -1) : line
    if (cleaned === '' || cleaned.startsWith(':')) continue
    const colon = cleaned.indexOf(':')
    if (colon === -1) continue
    const field = cleaned.slice(0, colon)
    const value = cleaned.slice(colon + 1).trimStart()
    if (field === 'event') {
      event = value
    } else if (field === 'data') {
      dataLines.push(value)
    }
  }
  if (dataLines.length === 0) return null
  return { event, data: dataLines.join('\n') }
}
