import { describe, expect, it } from 'vitest'
import { buildSnippetPrompt, parseSnippetSuggestion } from './snippetPrompt'

describe('parseSnippetSuggestion', () => {
  it('parses a clean JSON response', () => {
    const raw = '{"title":"Tail logs","body":"kubectl logs -f","tags":["k8s"]}'
    expect(parseSnippetSuggestion(raw)).toEqual({
      title: 'Tail logs',
      body: 'kubectl logs -f',
      tags: ['k8s'],
    })
  })

  it('extracts JSON from a ```json fenced block', () => {
    const raw = [
      'Here is the snippet:',
      '```json',
      '{ "title": "Tail logs", "body": "kubectl logs -f", "tags": ["k8s","ops"] }',
      '```',
      'Hope that helps!',
    ].join('\n')
    expect(parseSnippetSuggestion(raw)).toEqual({
      title: 'Tail logs',
      body: 'kubectl logs -f',
      tags: ['k8s', 'ops'],
    })
  })

  it('extracts JSON from any fenced block as a fallback', () => {
    const raw = '```\n{"title":"x","body":"y"}\n```'
    expect(parseSnippetSuggestion(raw)).toEqual({
      title: 'x',
      body: 'y',
      tags: [],
    })
  })

  it('falls back to using the raw response as body when no JSON is found', () => {
    const raw = 'No JSON here, just a command:\n\nkubectl get pods'
    const result = parseSnippetSuggestion(raw)
    expect(result.title).toBe('Generated snippet')
    expect(result.body).toContain('kubectl get pods')
    expect(result.tags).toEqual([])
  })

  it('strips a single bare code fence in the fallback path', () => {
    const raw = '```bash\nkubectl get pods\n```'
    const result = parseSnippetSuggestion(raw)
    // No top-level JSON, so we fall back. The fence should be stripped.
    expect(result.body).toBe('kubectl get pods')
  })

  it('rejects empty objects and falls back to the raw string', () => {
    const raw = '{}'
    const result = parseSnippetSuggestion(raw)
    expect(result.title).toBe('Generated snippet')
    expect(result.body).toBe('{}')
  })

  it('drops non-string entries in the tags array', () => {
    const raw = '{"title":"x","body":"y","tags":["a", 1, "b", null]}'
    expect(parseSnippetSuggestion(raw).tags).toEqual(['a', 'b'])
  })

  it('handles an empty input', () => {
    expect(parseSnippetSuggestion('')).toEqual({
      title: 'Generated snippet',
      body: '',
      tags: [],
    })
  })
})

describe('buildSnippetPrompt', () => {
  it('embeds the user description and the JSON schema instruction', () => {
    const prompt = buildSnippetPrompt('list pods that are not running')
    expect(prompt).toContain('Reply with strict JSON only')
    expect(prompt).toContain('list pods that are not running')
    expect(prompt).toContain('"title":')
    expect(prompt).toContain('"body":')
    expect(prompt).toContain('"tags":')
  })
})
