import { useState } from 'react'
import { Phone } from './components/Phone'
import type { TabId } from './components/TabBar'
import { ConnectScreen } from './screens/ConnectScreen'
import { HostSheetScreen } from './screens/HostSheetScreen'
import { HostsScreen } from './screens/HostsScreen'
import { MobileSettingsScreen } from './screens/MobileSettingsScreen'
import { SftpScreen } from './screens/SftpScreen'
import { SnippetsScreen } from './screens/SnippetsScreen'
import { TerminalAiScreen } from './screens/TerminalAiScreen'
import { TerminalScreen } from './screens/TerminalScreen'
import { TunnelsScreen } from './screens/TunnelsScreen'
import { UnlockScreen } from './screens/UnlockScreen'

type Screen =
  | 'connect'
  | 'unlock'
  | 'hosts'
  | 'host-sheet'
  | 'terminal'
  | 'terminal-ai'
  | 'snippets'
  | 'sftp'
  | 'tunnels'
  | 'settings'

const TAB_TO_SCREEN: Record<TabId, Screen> = {
  hosts: 'hosts',
  snippets: 'snippets',
  sftp: 'sftp',
  settings: 'settings',
}

const PICKER: ReadonlyArray<{ id: Screen; label: string }> = [
  { id: 'connect', label: '01 · Connect' },
  { id: 'unlock', label: '02 · Vault unlock' },
  { id: 'hosts', label: '03 · Hosts list' },
  { id: 'host-sheet', label: '04 · Host sheet' },
  { id: 'terminal', label: '05 · Terminal' },
  { id: 'terminal-ai', label: '06 · Terminal + AI' },
  { id: 'snippets', label: '07 · Snippets' },
  { id: 'sftp', label: '08 · SFTP' },
  { id: 'tunnels', label: '09 · Tunnels' },
  { id: 'settings', label: '10 · Settings' },
]

export function MobileApp() {
  const [screen, setScreen] = useState<Screen>('hosts')
  const onTab = (id: TabId) => setScreen(TAB_TO_SCREEN[id])

  let content: JSX.Element
  switch (screen) {
    case 'connect':
      content = <ConnectScreen />
      break
    case 'unlock':
      content = <UnlockScreen />
      break
    case 'hosts':
      content = <HostsScreen onOpenHost={() => setScreen('host-sheet')} onTabChange={onTab} />
      break
    case 'host-sheet':
      content = (
        <HostSheetScreen
          onOpenTerminal={() => setScreen('terminal')}
          onClose={() => setScreen('hosts')}
        />
      )
      break
    case 'terminal':
      content = <TerminalScreen onBack={() => setScreen('host-sheet')} />
      break
    case 'terminal-ai':
      content = <TerminalAiScreen onBack={() => setScreen('terminal')} />
      break
    case 'snippets':
      content = <SnippetsScreen onTabChange={onTab} />
      break
    case 'sftp':
      content = <SftpScreen onTabChange={onTab} />
      break
    case 'tunnels':
      content = <TunnelsScreen onBack={() => setScreen('hosts')} />
      break
    case 'settings':
      content = <MobileSettingsScreen onTabChange={onTab} />
      break
  }

  return (
    <>
      <Phone>{content}</Phone>
      <ScreenPicker active={screen} onPick={setScreen} />
      <BlinkKeyframes />
    </>
  )
}

/**
 * Floating screen picker shown only in browser preview so all 10 screens are
 * reachable without real auth/vault flows. Hidden inside Tauri (real device).
 */
function ScreenPicker({ active, onPick }: { active: Screen; onPick: (s: Screen) => void }) {
  const inDevice = typeof window === 'undefined' || !window.matchMedia('(min-width: 600px)').matches
  const [open, setOpen] = useState(true)
  if (inDevice) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 1000,
        background: 'rgba(20,18,14,0.96)',
        border: '0.5px solid rgba(255,255,255,0.10)',
        borderRadius: 12,
        boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
        color: '#e7e2d4',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 12,
        minWidth: 200,
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          color: '#7dd3a0',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          padding: '10px 12px',
          textAlign: 'left',
          cursor: 'pointer',
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          fontWeight: 600,
        }}
      >
        ▸ trominal mobile · screens
      </button>
      {open && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '4px 6px 8px',
            borderTop: '0.5px solid rgba(255,255,255,0.06)',
          }}
        >
          {PICKER.map((s) => (
            <button
              key={s.id}
              onClick={() => onPick(s.id)}
              style={{
                background: active === s.id ? 'rgba(125,211,160,0.12)' : 'transparent',
                color: active === s.id ? '#7dd3a0' : '#e7e2d4',
                border: 'none',
                padding: '6px 10px',
                borderRadius: 6,
                textAlign: 'left',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function BlinkKeyframes() {
  return (
    <style>{`
      @keyframes tr-blink {
        0%, 50% { opacity: 1; }
        50.01%, 100% { opacity: 0; }
      }
    `}</style>
  )
}
