import { describe, expect, it } from 'vitest'
import { sanitiseSuggestion } from './InlineSuggestion'

describe('sanitiseSuggestion', () => {
  it('returns a single command verbatim', () => {
    expect(sanitiseSuggestion('kubectl get pods -A')).toBe('kubectl get pods -A')
  })

  it('strips a ```bash fenced block and keeps the first command', () => {
    expect(sanitiseSuggestion('```bash\nkubectl get pods\n```')).toBe('kubectl get pods')
  })

  it('strips an unlabeled fence', () => {
    expect(sanitiseSuggestion('```\necho hi\n```')).toBe('echo hi')
  })

  it('keeps only the first non-empty line for multi-line responses', () => {
    expect(sanitiseSuggestion('first command\n\nsecond command')).toBe('first command')
  })

  it('drops a leading shell-prompt token', () => {
    expect(sanitiseSuggestion('$ ls -la')).toBe('ls -la')
    expect(sanitiseSuggestion('> npm test')).toBe('npm test')
    expect(sanitiseSuggestion('# whoami')).toBe('whoami')
  })

  it('returns an empty string for blank input', () => {
    expect(sanitiseSuggestion('')).toBe('')
    expect(sanitiseSuggestion('   ')).toBe('')
  })
})
