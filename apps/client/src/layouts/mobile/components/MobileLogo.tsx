export function MobileLogo({ size = 14 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        fontSize: size,
        letterSpacing: '-0.01em',
        color: '#e7e2d4',
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'inline-block',
          width: size,
          height: size,
          borderRadius: 2,
          background: '#7dd3a0',
        }}
      />
      trominal
    </span>
  )
}
