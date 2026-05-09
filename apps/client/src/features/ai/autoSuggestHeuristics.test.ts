import { describe, expect, it } from 'vitest'
import {
  evaluateAutoSuggest,
  looksLikePasswordPrompt,
  looksLikeShellPrompt,
} from './autoSuggestHeuristics'

describe('looksLikeShellPrompt', () => {
  it('accepts common shell prompt suffixes', () => {
    expect(looksLikeShellPrompt('user@host:~$ ')).toBe(true)
    expect(looksLikeShellPrompt('root@box:/tmp# ')).toBe(true)
    expect(looksLikeShellPrompt('PS C:\\Users\\foo> ')).toBe(true)
    expect(looksLikeShellPrompt('user ❯ ')).toBe(true)
    expect(looksLikeShellPrompt('user → ')).toBe(true)
    expect(looksLikeShellPrompt('me % ')).toBe(true)
  })

  it('rejects non-prompt lines', () => {
    expect(looksLikeShellPrompt('Loading file…')).toBe(false)
    expect(looksLikeShellPrompt('')).toBe(false)
    expect(looksLikeShellPrompt('     ')).toBe(false)
  })
})

describe('looksLikePasswordPrompt', () => {
  it('matches common password-prompt patterns', () => {
    expect(looksLikePasswordPrompt('Password: ')).toBe(true)
    expect(looksLikePasswordPrompt('password:')).toBe(true)
    expect(looksLikePasswordPrompt('[sudo] password for armend: ')).toBe(true)
    expect(looksLikePasswordPrompt('Enter passphrase for key /home/x/.ssh/id_ed25519: ')).toBe(true)
    expect(looksLikePasswordPrompt('Verify password:')).toBe(true)
    expect(looksLikePasswordPrompt('user@host: Permission denied, please try again.')).toBe(false)
  })

  it('matches yes/no confirmation prompts that we should not auto-complete through', () => {
    expect(looksLikePasswordPrompt('Are you sure you want to continue connecting (yes/no)? ')).toBe(
      true,
    )
    expect(looksLikePasswordPrompt('Continue [Y/n]? ')).toBe(true)
  })

  it('rejects regular shell prompts', () => {
    expect(looksLikePasswordPrompt('user@host:~$ ')).toBe(false)
    expect(looksLikePasswordPrompt('root@box:/etc# ')).toBe(false)
  })
})

describe('evaluateAutoSuggest', () => {
  const baseInput = {
    isAlternateScreen: false,
    lastLine: 'user@host:~$ git status',
    typedSincePromptStart: 'git status',
    msSinceDismissal: 60_000,
    msSinceLastServerOutput: 800,
  }

  it('allows the request on the happy path', () => {
    expect(evaluateAutoSuggest(baseInput)).toEqual({ ok: true })
  })

  it('blocks when alternate screen is active (vim/tmux/less)', () => {
    expect(evaluateAutoSuggest({ ...baseInput, isAlternateScreen: true })).toMatchObject({
      ok: false,
      reason: 'alternate-screen',
    })
  })

  it('blocks when the prompt looks like a password / passphrase request', () => {
    expect(
      evaluateAutoSuggest({
        ...baseInput,
        lastLine: '[sudo] password for armend: ',
        typedSincePromptStart: 'sec',
      }),
    ).toMatchObject({ ok: false, reason: 'password-prompt' })
  })

  it('blocks when the line does not look like a shell prompt at all', () => {
    expect(
      evaluateAutoSuggest({
        ...baseInput,
        lastLine: 'Loading file… please wait',
        typedSincePromptStart: '',
      }),
    ).toMatchObject({ ok: false, reason: 'no-prompt' })
  })

  it('blocks when the user has not typed enough characters yet', () => {
    expect(evaluateAutoSuggest({ ...baseInput, typedSincePromptStart: 'g' })).toMatchObject({
      ok: false,
      reason: 'too-little-input',
    })
  })

  it('blocks during the dismissal cooldown window', () => {
    expect(evaluateAutoSuggest({ ...baseInput, msSinceDismissal: 1_000 })).toMatchObject({
      ok: false,
      reason: 'cooldown',
    })
  })

  it('blocks while the server is still streaming output', () => {
    expect(evaluateAutoSuggest({ ...baseInput, msSinceLastServerOutput: 50 })).toMatchObject({
      ok: false,
      reason: 'server-output',
    })
  })
})
