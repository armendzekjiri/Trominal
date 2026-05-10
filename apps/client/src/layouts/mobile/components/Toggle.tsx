export function Toggle({ on = false }: { on?: boolean }) {
  return (
    <span
      role="switch"
      aria-checked={on}
      style={{
        width: 38,
        height: 22,
        borderRadius: 999,
        background: on ? '#7dd3a0' : 'rgba(255,255,255,0.12)',
        position: 'relative',
        flexShrink: 0,
        transition: 'background 0.15s ease',
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 18 : 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
          transition: 'left 0.15s ease',
        }}
      />
    </span>
  )
}
