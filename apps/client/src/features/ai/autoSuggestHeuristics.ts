/**
 * Heuristics that decide whether the auto-debounced inline suggester should
 * fire. Phase 7B chose a manual Ctrl+Space trigger because auto-debounce
 * fights with vim/tmux/sudo prompts; Phase 7C adds the auto path behind these
 * suppressors so it stays out of those modes.
 *
 * The function is deliberately a pure inspector of a snapshot — the caller
 * (InlineSuggestion) builds the snapshot from xterm + bookkeeping and asks
 * "should I trigger right now?" before kicking off an API request.
 */

const PROMPT_SUFFIX_RE = /[$#>%❯→]\s*$/u
const PROMPT_INLINE_RE = /[$#>%❯→]\s+\S/u

const PASSWORD_PATTERNS: RegExp[] = [
  /(?:^|\s)password\s*(?:for\s+\S+)?\s*:\s*$/i,
  /\[sudo\]\s+password/i,
  /enter\s+(?:the\s+)?(?:new\s+)?passphrase/i,
  /verify\s+password/i,
  /(?:current|old|new)\s+password\s*:/i,
  /\(yes\/no\)\s*\??\s*$/i,
  /\[(?:y\/n|n\/y|y\/n\/q)\]\s*\??\s*$/i,
]

const MIN_TYPED_CHARS = 2
const DISMISS_COOLDOWN_MS = 5_000
const SERVER_QUIESCE_MS = 250

export type AutoSuggestSnapshot = {
  /** xterm reports `buffer.active.type === 'alternate'` for vim/less/tmux/htop. */
  isAlternateScreen: boolean
  /** The prompt line as visible right now, including any text the user just typed. */
  lastLine: string
  /** What the user has typed since the last newline (their in-progress command). */
  typedSincePromptStart: string
  /** ms since the user last dismissed a suggestion with Esc. */
  msSinceDismissal: number
  /** ms since the SSH session last wrote output to the terminal. */
  msSinceLastServerOutput: number
}

export type AutoSuggestDecision =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'alternate-screen'
        | 'password-prompt'
        | 'no-prompt'
        | 'too-little-input'
        | 'cooldown'
        | 'server-output'
    }

export function evaluateAutoSuggest(snapshot: AutoSuggestSnapshot): AutoSuggestDecision {
  if (snapshot.isAlternateScreen) return { ok: false, reason: 'alternate-screen' }
  if (snapshot.msSinceDismissal < DISMISS_COOLDOWN_MS) return { ok: false, reason: 'cooldown' }
  if (snapshot.msSinceLastServerOutput < SERVER_QUIESCE_MS) {
    return { ok: false, reason: 'server-output' }
  }
  if (looksLikePasswordPrompt(snapshot.lastLine)) return { ok: false, reason: 'password-prompt' }
  if (!looksLikeShellPrompt(snapshot.lastLine)) return { ok: false, reason: 'no-prompt' }
  if (snapshot.typedSincePromptStart.trim().length < MIN_TYPED_CHARS) {
    return { ok: false, reason: 'too-little-input' }
  }
  return { ok: true }
}

/**
 * The line ends in a shell-prompt-like sigil with optional trailing whitespace,
 * or has the sigil mid-line followed by partial command text (e.g.
 * "user@host:~$ git st").
 */
export function looksLikeShellPrompt(line: string): boolean {
  if (line.trim() === '') return false
  return PROMPT_SUFFIX_RE.test(line) || PROMPT_INLINE_RE.test(line)
}

export function looksLikePasswordPrompt(line: string): boolean {
  return PASSWORD_PATTERNS.some((pattern) => pattern.test(line))
}
