import { useMemo } from 'react'
import { encode } from 'uqr'
import { cn } from '@/lib/cn'

export type QrCodeProps = {
  value: string
  /** Accessible name, e.g. "QR code for your authenticator app". */
  label: string
  size?: number
  className?: string
}

/**
 * Scannable QR code drawn as inline SVG. Always dark modules on white, whatever the theme:
 * authenticator apps don't reliably read inverted codes.
 */
export function QrCode({ value, label, size = 168, className }: QrCodeProps) {
  const { path, modules } = useMemo(() => {
    // Quiet zone of 4 modules, as the QR spec requires for reliable scanning.
    const qr = encode(value, { ecc: 'M', border: 4 })
    let d = ''
    qr.data.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`
      })
    })
    return { path: d, modules: qr.size }
  }, [value])

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${modules} ${modules}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={cn('rounded-md', className)}
    >
      <rect width={modules} height={modules} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  )
}
