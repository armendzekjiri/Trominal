import '@xterm/xterm/css/xterm.css'

import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { useEffect, useRef } from 'react'
import type { SshSession } from '@trominal/ssh-transport'

type XtermPaneProps = {
  session: SshSession | null
  title: string
  /**
   * Optional ref the parent can use to peek at the live xterm instance —
   * needed by the Ask AI panel to read the last N lines of scrollback. The
   * pane assigns the current Terminal on mount and clears it on unmount.
   */
  terminalRef?: { current: Terminal | null }
}

const encoder = new TextEncoder()

export function XtermPane({ session, title, terminalRef: externalRef }: XtermPaneProps) {
  const elementRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)

  useEffect(() => {
    const element = elementRef.current
    if (element === null) {
      return undefined
    }

    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 13,
      theme: {
        background: '#14130f',
        foreground: '#c8c2b0',
        cursor: '#7dd3a0',
        black: '#14130f',
        red: '#f17a7a',
        green: '#7dd3a0',
        yellow: '#e0b870',
        blue: '#7aa2f7',
        magenta: '#c897e0',
        cyan: '#7dd3c0',
        white: '#c8c2b0',
        brightBlack: '#4a463a',
        brightRed: '#ff8f8f',
        brightGreen: '#92dfb1',
        brightYellow: '#ecc78a',
        brightBlue: '#93b4f8',
        brightMagenta: '#d3aae6',
        brightCyan: '#92dccc',
        brightWhite: '#e7e2d4',
      },
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

    return () => {
      dataDisposable.dispose()
      resizeObserver.disconnect()
      terminal.dispose()
      terminalRef.current = null
      if (externalRef !== undefined) {
        externalRef.current = null
      }
    }
  }, [session, title, externalRef])

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
