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
    if (externalRef !== undefined) {
      externalRef.current = terminal
    }

    const resizeObserver = new ResizeObserver(() => {
      fit.fit()
      session?.resize(terminal.cols, terminal.rows)
    })
    resizeObserver.observe(element)

    terminal.writeln(`Trominal session: ${title}`)
    terminal.writeln('Press connect to open an SSH transport.')
    terminal.writeln('')

    const dataDisposable = terminal.onData((data) => {
      session?.write(encoder.encode(data))
    })

    const readyDisposer = onTerminalReady?.(terminal, element)

    return () => {
      readyDisposer?.()
      dataDisposable.dispose()
      resizeObserver.disconnect()
      terminal.dispose()
      terminalRef.current = null
      if (externalRef !== undefined) {
        externalRef.current = null
      }
    }
  }, [session, title, externalRef, onTerminalReady, terminalFontSize, terminalTheme])

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
