import '@xterm/xterm/css/xterm.css'

import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { useEffect, useMemo, useRef } from 'react'
import type { SshSession } from '@trominal/ssh-transport'
import { terminalThemeFor, useAppearance } from '@/stores/appearance'

type XtermPaneProps = {
  session: SshSession | null
  /**
   * True when this pane belongs to the active tab. While inactive the
   * pane is hidden via CSS; on transition to active we re-fit the
   * geometry (the element width/height was effectively 0 while hidden)
   * and re-focus the terminal so keystrokes land in the right place.
   */
  isActive: boolean
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
  isActive,
  terminalRef: externalRef,
  onTerminalReady,
}: XtermPaneProps) {
  const elementRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
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
  const readyHandlerRef = useRef<XtermPaneProps['onTerminalReady']>(onTerminalReady)
  const externalRefRef = useRef(externalRef)
  useEffect(() => {
    sessionRef.current = session
  }, [session])
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
      // Prefer a system-installed Nerd Font so powerline glyphs / Devicons /
      // Material icons that themes like p10k, agnoster, and starship rely on
      // render correctly. Falls back to plain JetBrains Mono (bundled via
      // @fontsource) and then OS monospace defaults. To get full glyph
      // coverage without relying on a system install, install
      // "JetBrainsMono Nerd Font" from https://www.nerdfonts.com/font-downloads
      // — bundling it ourselves is on the roadmap.
      fontFamily:
        '"JetBrainsMono Nerd Font Mono", "JetBrainsMono Nerd Font", "MesloLGS NF", "FiraCode Nerd Font Mono", "JetBrains Mono", ui-monospace, monospace',
      fontSize: terminalFontSize,
      theme: terminalTheme,
    })
    // Note: xterm v6 ships only unicode v6 width tables. Powerline arrows
    // and emoji can still render at the wrong cell width; pulling in
    // `@xterm/addon-unicode11` would fix that and is on the follow-up list.
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    terminal.open(element)
    fit.fit()
    terminalRef.current = terminal
    fitRef.current = fit
    const externalSlot = externalRefRef.current
    if (externalSlot !== undefined) {
      externalSlot.current = terminal
    }

    const resizeObserver = new ResizeObserver(() => {
      fit.fit()
      sessionRef.current?.resize(terminal.cols, terminal.rows)
    })
    resizeObserver.observe(element)

    const dataDisposable = terminal.onData((data) => {
      sessionRef.current?.write(encoder.encode(data))
    })

    const readyDisposer = readyHandlerRef.current?.(terminal, element)

    // Focus on first paint so the user can type immediately. The shell's
    // own output (PS1, prompt, banner) takes over from here.
    terminal.focus()

    return () => {
      readyDisposer?.()
      dataDisposable.dispose()
      resizeObserver.disconnect()
      terminal.dispose()
      terminalRef.current = null
      fitRef.current = null
      const slot = externalRefRef.current
      if (slot !== undefined) {
        slot.current = null
      }
    }
  }, [terminalFontSize, terminalTheme])

  // Becoming the active tab: the pane was hidden (display:none) so
  // FitAddon's last call computed against a 0×0 element. Re-fit on the
  // next frame once layout has settled, then return focus.
  useEffect(() => {
    if (!isActive) return undefined
    const terminal = terminalRef.current
    const fit = fitRef.current
    if (terminal === null || fit === null) return undefined
    const handle = requestAnimationFrame(() => {
      fit.fit()
      sessionRef.current?.resize(terminal.cols, terminal.rows)
      terminal.focus()
    })
    return () => cancelAnimationFrame(handle)
  }, [isActive])

  // Session subscription: re-runs whenever a new session is attached
  // without disturbing the terminal instance. Also re-focuses on every
  // session change so switching tabs lands keystrokes in the right place
  // (the previous click usually moved focus to a tab button).
  useEffect(() => {
    const terminal = terminalRef.current
    if (terminal === null) return undefined
    terminal.focus()

    if (session === null) return undefined

    const unsubscribeData = session.onData((chunk) => terminal.write(chunk))
    const unsubscribeClose = session.onClose((reason) => {
      terminal.writeln('')
      terminal.writeln(`Disconnected: ${reason}`)
    })

    return () => {
      unsubscribeData()
      unsubscribeClose()
    }
  }, [session])

  return <div ref={elementRef} className="h-full min-h-0 bg-ansi-black" />
}
