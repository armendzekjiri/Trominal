type State = 'connected' | 'connecting' | 'idle' | 'error' | 'disconnected'

const colorFor: Record<State, string> = {
  connected: '#7dd3a0',
  connecting: '#e0b870',
  idle: '#6e6957',
  error: '#f17a7a',
  disconnected: '#f17a7a',
}

export function MobileDot({ state = 'idle', size = 6 }: { state?: State; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: colorFor[state],
        boxShadow: state === 'connected' ? '0 0 6px rgba(125,211,160,0.5)' : undefined,
      }}
    />
  )
}
