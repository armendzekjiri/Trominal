import { Check, Minus, Monitor, Moon, Palette, Plus, RotateCcw, Sun, Type } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import {
  APP_THEME_OPTIONS,
  MAX_TERMINAL_FONT_SIZE,
  MIN_TERMINAL_FONT_SIZE,
  TERMINAL_PALETTES,
  terminalThemeFor,
  useAppearance,
  type AppTheme,
  type TerminalTheme,
} from '@/stores/appearance'

const ANSI_SWATCHES: ReadonlyArray<
  keyof Pick<
    TerminalTheme,
    'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white'
  >
> = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']

export function AppearanceTab() {
  const appTheme = useAppearance((state) => state.appTheme)
  const terminalFontSize = useAppearance((state) => state.terminalFontSize)
  const terminalPalette = useAppearance((state) => state.terminalPalette)
  const setAppTheme = useAppearance((state) => state.setAppTheme)
  const setTerminalFontSize = useAppearance((state) => state.setTerminalFontSize)
  const setTerminalPalette = useAppearance((state) => state.setTerminalPalette)
  const resetAppearance = useAppearance((state) => state.resetAppearance)
  const previewTheme = terminalThemeFor(terminalPalette)

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold">Appearance</h1>
          <p className="mt-1 text-[12px] text-fg-muted">
            Theme, terminal type size, and ANSI palette.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={resetAppearance}>
          <RotateCcw size={13} />
          Reset
        </Button>
      </header>

      <section className="rounded-md border border-border bg-surface p-4">
        <SettingsSectionHeader
          icon={<Palette size={14} />}
          title="Theme"
          detail="Controls the app chrome."
        />
        <div className="grid gap-2 sm:grid-cols-3">
          {APP_THEME_OPTIONS.map((option) => {
            const active = option.id === appTheme
            const Icon = themeIcon(option.id)
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setAppTheme(option.id)}
                className={cn(
                  'flex min-h-24 flex-col gap-2 rounded-md border p-3 text-left transition-colors',
                  active
                    ? 'border-accent bg-accent-soft text-fg'
                    : 'border-border-subtle bg-surface-2 text-fg-muted hover:border-border-strong hover:text-fg',
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <Icon size={15} className={active ? 'text-accent' : 'text-fg-faint'} />
                  {active ? <Check size={14} className="text-accent" /> : null}
                </span>
                <span className="text-[13px] font-medium">{option.label}</span>
                <span className="text-[11px] leading-relaxed text-fg-faint">
                  {option.description}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="rounded-md border border-border bg-surface p-4">
        <SettingsSectionHeader
          icon={<Type size={14} />}
          title="Terminal font size"
          detail="Applied to newly rendered terminal panes."
        />
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            aria-label="Decrease terminal font size"
            disabled={terminalFontSize <= MIN_TERMINAL_FONT_SIZE}
            onClick={() => setTerminalFontSize(terminalFontSize - 1)}
          >
            <Minus size={13} />
          </Button>
          <input
            type="range"
            min={MIN_TERMINAL_FONT_SIZE}
            max={MAX_TERMINAL_FONT_SIZE}
            value={terminalFontSize}
            onChange={(event) => setTerminalFontSize(Number(event.target.value))}
            className="h-2 min-w-0 flex-1 accent-accent"
          />
          <Button
            size="sm"
            variant="outline"
            aria-label="Increase terminal font size"
            disabled={terminalFontSize >= MAX_TERMINAL_FONT_SIZE}
            onClick={() => setTerminalFontSize(terminalFontSize + 1)}
          >
            <Plus size={13} />
          </Button>
          <span className="w-14 rounded-sm border border-border-subtle bg-surface-2 px-2 py-1 text-center font-mono text-[12px] text-fg">
            {terminalFontSize}px
          </span>
        </div>
      </section>

      <section className="rounded-md border border-border bg-surface p-4">
        <SettingsSectionHeader
          icon={<Monitor size={14} />}
          title="Terminal palette"
          detail="Colors used by xterm.js sessions."
        />
        <div className="grid gap-2">
          {TERMINAL_PALETTES.map((palette) => {
            const active = palette.id === terminalPalette
            return (
              <button
                key={palette.id}
                type="button"
                onClick={() => setTerminalPalette(palette.id)}
                className={cn(
                  'grid gap-3 rounded-md border p-3 text-left transition-colors sm:grid-cols-[140px_1fr_auto]',
                  active
                    ? 'border-accent bg-accent-soft'
                    : 'border-border-subtle bg-surface-2 hover:border-border-strong',
                )}
              >
                <span className="grid h-9 grid-cols-8 overflow-hidden rounded-sm border border-border-subtle">
                  {ANSI_SWATCHES.map((swatch) => (
                    <span
                      key={swatch}
                      aria-hidden
                      style={{ backgroundColor: palette.theme[swatch] }}
                    />
                  ))}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-fg">{palette.label}</span>
                  <span className="block text-[11px] text-fg-faint">{palette.description}</span>
                </span>
                {active ? <Check size={14} className="self-center text-accent" /> : null}
              </button>
            )
          })}
        </div>

        <div
          className="mt-4 rounded-md border border-border-subtle p-3 font-mono text-[12px] leading-6"
          style={{
            backgroundColor: previewTheme.background,
            color: previewTheme.foreground,
            fontSize: terminalFontSize,
          }}
        >
          <div>
            <span style={{ color: previewTheme.green }}>armend@trominal</span>
            <span style={{ color: previewTheme.foreground }}>:</span>
            <span style={{ color: previewTheme.blue }}>~/project</span>
            <span style={{ color: previewTheme.foreground }}>$ pnpm test</span>
          </div>
          <div style={{ color: previewTheme.yellow }}>RUN v4.1.5 apps/client</div>
          <div style={{ color: previewTheme.green }}>Tests 69 passed</div>
        </div>
      </section>
    </div>
  )
}

function SettingsSectionHeader({
  icon,
  title,
  detail,
}: {
  icon: ReactNode
  title: string
  detail: string
}) {
  return (
    <header className="mb-3 flex items-center gap-3">
      <span className="rounded-md bg-accent-soft p-2 text-accent">{icon}</span>
      <div>
        <div className="text-[13px] font-medium text-fg">{title}</div>
        <div className="font-mono text-[11px] text-fg-faint">{detail}</div>
      </div>
    </header>
  )
}

function themeIcon(theme: AppTheme) {
  switch (theme) {
    case 'light':
      return Sun
    case 'system':
      return Monitor
    case 'dark':
    default:
      return Moon
  }
}
