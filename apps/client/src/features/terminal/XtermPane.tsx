import '@xterm/xterm/css/xterm.css'

import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { useEffect, useMemo, useRef } from 'react'
import type { SshSession } from '@trominal/ssh-transport'
import { terminalThemeFor, useAppearance } from '@/stores/appearance'

type XtermPaneProps = {
  session: SshSession | null
  title: string
  /**
   * Optional ref the parent can use to peek at the live xterm instance —
   * needed by the Ask AI panel to read the last N lines of scrollback. The
   * pane assigns the current Terminal on mount and clears it on unmount.
   */
  terminalRef?: { current: Terminal | null }
  /**
   * Fired once after a Terminal is mounted into the DOM. Phase 7B uses it
   * to attach inline-suggestion + context-menu behaviours over the live
   * instance. Returning a disposer lets the consumer detach cleanly.
   */
  onTerminalReady?: (terminal: Terminal, element: HTMLDivElement) => (() => void) | void
}

const encoder = new TextEncoder()

export function XtermPane({
  session,
  title,
  terminalRef: externalRef,
  onTerminalReady,
}: XtermPaneProps) {
  const elementRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const terminalFontSize = useAppearance((state) => state.terminalFontSize)
  const terminalPalette = useAppearance((state) => state.terminalPalette)
  const terminalTheme = useMemo(() => terminalThemeFor(terminalPalette), [terminalPalette])

  // Late-binding refs for handlers that capture into the resize observer +
  // xterm.onData closure. The terminal lifecycle effect runs once per
  // mount; without these refs, every change to `session` / `onTerminalReady`
  // would dispose and recreate the terminal — the visible "flash" the user
  // saw on every Connect. The session prop and ready-handler can change
  // freely without re-mounting the xterm.
  const sessionRef = useRef<SshSession | null>(null)
  const titleRef = useRef(title)
  const readyHandlerRef = useRef<XtermPaneProps['onTerminalReady']>(onTerminalReady)
  const externalRefRef = useRef(externalRef)
  useEffect(() => {
    sessionRef.current = session
  }, [session])
  useEffect(() => {
    titleRef.current = title
  }, [title])
  useEffect(() => {
    readyHandlerRef.current = onTerminalReady
  }, [onTerminalReady])
  useEffect(() => {
    externalRefRef.current = externalRef
  }, [externalRef])

  // Terminal lifecycle: create on mount + when display options actually
  // change. NOT on session / title / handler changes — those are read
  // through refs above.
  useEffect(() => {
    const element = elementRef.current
    if (element === null) {
      return undefined
    }

    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: terminalFontSize,
      theme: terminalTheme,
    })
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    terminal.open(element)
    fit.fit()
    terminalRef.current = terminal
    const externalSlot = externalRefRef.current
    if (externalSlot !== undefined) {
      externalSlot.current = terminal
    }

    const resizeObserver = new ResizeObserver(() => {
      fit.fit()
      sessionRef.current?.resize(terminal.cols, terminal.rows)
    })
    resizeObserver.observe(element)

    terminal.writeln(`Trominal session: ${titleRef.current}`)
    terminal.writeln('Press connect to open an SSH transport.')
    terminal.writeln('')

    const dataDisposable = terminal.onData((data) => {
      sessionRef.current?.write(encoder.encode(data))
    })

    const readyDisposer = readyHandlerRef.current?.(terminal, element)

    return () => {
      readyDisposer?.()
      dataDisposable.dispose()
      resizeObserver.disconnect()
      terminal.dispose()
      terminalRef.current = null
      const slot = externalRefRef.current
      if (slot !== undefined) {
        slot.current = null
      }
    }
  }, [terminalFontSize, terminalTheme])

  // Session subscription: re-runs whenever a new session is attached
  // without disturbing the terminal instance.
  useEffect(() => {
    const terminal = terminalRef.current
    if (terminal === null || session === null) {
      return undefined
    }

    const unsubscribeData = session.onData((chunk) => terminal.write(chunk))
    const unsubscribeClose = session.onClose((reason) => {
      terminal.writeln('')
      terminal.writeln(`Disconnected: ${reason}`)
    })
    terminal.writeln(`Connecting via ${session.id}...`)

    return () => {
      unsubscribeData()
      unsubscribeClose()
    }
  }, [session])

  return <div ref={elementRef} className="h-full min-h-0 bg-ansi-black" />
}
