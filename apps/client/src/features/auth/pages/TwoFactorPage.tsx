import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthShell } from '@/components/auth/AuthShell'
import { Button } from '@/components/ui/button'
import { useServerDisplay } from '@/features/auth/server-display'

const CODE_LENGTH = 6

/**
 * Step-up TOTP entry. Phase 4 routes here from any explicit 2FA challenge;
 * later phases will compose this into the master-password-change and
 * vault-export flows. The entry is purely visual today and submits to the
 * server only via flows that need it.
 */
export function TwoFactorPage() {
  const navigate = useNavigate()
  const server = useServerDisplay()
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const inputs = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    inputs.current[0]?.focus()
  }, [])

  const setDigit = (i: number, value: string): void => {
    const clean = value.replace(/\D/g, '').slice(-1)
    setDigits((prev) => {
      const next = [...prev]
      next[i] = clean
      return next
    })
    if (clean !== '' && i < CODE_LENGTH - 1) {
      inputs.current[i + 1]?.focus()
    }
  }

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Backspace' && digits[i] === '' && i > 0) {
      inputs.current[i - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>): void => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH)
    if (pasted.length === 0) return
    e.preventDefault()
    setDigits(Array.from({ length: CODE_LENGTH }, (_, i) => pasted[i] ?? ''))
    const last = Math.min(pasted.length, CODE_LENGTH - 1)
    inputs.current[last]?.focus()
  }

  const code = digits.join('')
  const ready = code.length === CODE_LENGTH

  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!ready) return
    // Wired in a follow-up phase: pass `code` to whichever step-up flow
    // brought us here. For now, return the user to the unlock screen.
    navigate('/unlock')
  }

  return (
    <AuthShell
      title="Two-factor authentication"
      subtitle="Enter the 6-digit code from your authenticator app."
      server={server}
    >
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <div className="flex justify-center gap-2 pt-1">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el
              }}
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => handleKey(i, e)}
              onPaste={handlePaste}
              className="h-14 w-12 rounded-md border border-border-strong bg-surface text-center font-mono text-[22px] font-medium text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent-ring"
            />
          ))}
        </div>
        <Button type="submit" variant="primary" full size="lg" disabled={!ready}>
          Verify
        </Button>
      </form>
    </AuthShell>
  )
}
