import * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * Trominal text field — matches the `<Input>` primitive shown in
 * `.ai/design/screens-auth.jsx`. Supports a leading icon, trailing suffix
 * (commonly an eye-toggle), and an optional hint line under the field. Use
 * the `mono` flag for fields that contain machine-readable text.
 */
export type TextInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> & {
  label?: string
  icon?: React.ReactNode
  suffix?: React.ReactNode
  hint?: string
  error?: string
  mono?: boolean
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { label, icon, suffix, hint, error, mono, className, id, ...props },
  ref,
) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId

  return (
    <div className="flex flex-col gap-1.5">
      {label !== undefined && (
        <label
          htmlFor={inputId}
          className="text-[11px] font-medium uppercase tracking-wide text-fg-muted"
        >
          {label}
        </label>
      )}
      <div
        className={cn(
          'flex h-10 items-center gap-2.5 rounded-md border border-border-strong bg-surface px-3',
          'transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-ring',
          error !== undefined ? 'border-danger focus-within:border-danger' : '',
        )}
      >
        {icon !== undefined && (
          <span className="flex shrink-0 text-fg-faint" aria-hidden>
            {icon}
          </span>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            'flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-faint',
            mono === true ? 'font-mono' : '',
            className,
          )}
          {...props}
        />
        {suffix !== undefined && <span className="flex shrink-0 text-fg-faint">{suffix}</span>}
      </div>
      {error !== undefined ? (
        <span className="text-[11px] text-danger">{error}</span>
      ) : hint !== undefined ? (
        <span className="text-[11px] text-fg-faint">{hint}</span>
      ) : null}
    </div>
  )
})
