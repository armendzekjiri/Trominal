import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { useHostKeyPrompt, type HostKeyPrompt } from './host-key-prompt'
import { keyTypeLabel, type ScannedHostKey } from './host-keys'

/** Global host-key dialog; driven by `useHostKeyPrompt` (see `useHostKeyGate`). */
export function HostKeyDialog() {
  const prompt = useHostKeyPrompt((state) => state.prompt)
  return prompt === null ? null : <HostKeyDialogContent prompt={prompt} />
}

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

function HostKeyDialogContent({ prompt }: { prompt: HostKeyPrompt }) {
  const answer = useHostKeyPrompt((state) => state.answer)
  const navigate = useNavigate()
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const warning = prompt.mode !== 'approve'
  const titleId = 'host-key-dialog-title'
  const descriptionId = 'host-key-dialog-description'

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    // The safe choice gets focus, so Enter never trusts a key by accident.
    cancelRef.current?.focus()
    return () => previous?.focus?.()
  }, [prompt])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      event.stopPropagation()
      answer(false)
      return
    }
    if (event.key !== 'Tab' || dialogRef.current === null) return
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const title =
    prompt.mode === 'approve'
      ? 'Verify host key'
      : prompt.mode === 'replace'
        ? 'Replace approved host key?'
        : 'Host key changed'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) answer(false)
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={onKeyDown}
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border-strong bg-bg-elev shadow-2xl"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-4">
          <span
            aria-hidden
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-md',
              warning ? 'bg-danger-soft text-danger' : 'bg-accent-soft text-accent',
            )}
          >
            {warning ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-[15px] font-semibold text-fg">
              {title}
            </h2>
            <p className="truncate font-mono text-[11px] text-fg-faint">{prompt.endpoint}</p>
          </div>
        </div>

        <div className="grid min-h-0 gap-4 overflow-auto p-5">
          <p id={descriptionId} className="text-[13px] leading-5 text-fg-muted">
            {prompt.mode === 'approve' ? (
              <>
                First connection to <span className="text-fg">{prompt.label}</span>. Compare these
                fingerprints with the ones your server administrator gave you (or{' '}
                <code className="font-mono text-[12px]">ssh-keygen -lf</code> on the server) before
                trusting it.
              </>
            ) : (
              <>
                The server is presenting a different key than the one you approved. This can happen
                after a reinstall, but it can also mean someone is intercepting the connection.{' '}
                {prompt.mode === 'changed'
                  ? 'Trominal did not connect. Re-approve the key from the host editor only if you have confirmed the change.'
                  : 'Only replace the approved key if you have confirmed the new fingerprint.'}
              </>
            )}
          </p>

          {prompt.expected.length > 0 && warning && (
            <FingerprintList label="Approved" keys={prompt.expected} />
          )}
          <FingerprintList
            label={warning ? 'Server now presents' : 'Server presents'}
            keys={prompt.presented}
            empty="The server's current key could not be read."
          />

          {prompt.sessionOnly && prompt.mode !== 'changed' && (
            <p className="text-[12px] text-fg-faint">
              Team hosts can&apos;t store approvals yet, so this one lasts until Trominal restarts.
            </p>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-4">
          {prompt.mode === 'changed' ? (
            <>
              <Button ref={cancelRef} type="button" variant="outline" onClick={() => answer(false)}>
                Close
              </Button>
              {prompt.hostId !== null && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    answer(false)
                    navigate(`/hosts?edit=${encodeURIComponent(prompt.hostId ?? '')}`)
                  }}
                >
                  Open host editor
                </Button>
              )}
            </>
          ) : (
            <>
              <Button ref={cancelRef} type="button" variant="outline" onClick={() => answer(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant={prompt.mode === 'replace' ? 'danger' : 'primary'}
                disabled={prompt.presented.length === 0}
                onClick={() => answer(true)}
              >
                {prompt.mode === 'replace' ? 'Replace approved key' : 'Trust and connect'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function FingerprintList({
  label,
  keys,
  empty,
}: {
  label: string
  keys: ScannedHostKey[]
  empty?: string
}) {
  return (
    <section className="grid gap-1.5">
      <h3 className="text-[11px] font-medium text-fg-faint">{label}</h3>
      {keys.length === 0 ? (
        <p className="text-[12px] text-fg-faint">{empty}</p>
      ) : (
        <ul className="grid gap-1.5">
          {keys.map((key) => (
            <li
              key={`${key.keyType} ${key.publicKey}`}
              className="rounded-md border border-border bg-surface px-3 py-2"
            >
              <div className="text-[11px] font-medium text-fg-muted">
                {keyTypeLabel(key.keyType)}
              </div>
              <div className="break-all font-mono text-[12px] text-fg">{key.fingerprint}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
