import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useCommandUi } from './command-ui'
import { ShortcutList } from './ShortcutList'

export function ShortcutsDialog() {
  const open = useCommandUi((s) => s.open === 'shortcuts')
  return open ? <SheetDialog /> : null
}

function SheetDialog() {
  const close = useCommandUi((s) => s.close)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    return () => previous?.focus?.()
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            close()
          }
          // Only one control inside: keep focus in the dialog.
          if (event.key === 'Tab') event.preventDefault()
        }}
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border-strong bg-bg-elev shadow-2xl"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5">
          <h2 id="shortcuts-title" className="text-[15px] font-semibold text-fg">
            Keyboard shortcuts
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Close"
            className="rounded-md p-1.5 text-fg-faint transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X size={15} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 overflow-auto p-5">
          <ShortcutList />
        </div>
      </div>
    </div>
  )
}
