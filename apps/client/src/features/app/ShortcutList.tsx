import { Kbd } from '@/components/ui/kbd'
import { SHORTCUTS, type Shortcut } from '@/lib/shortcuts'

const GROUPS: ReadonlyArray<Shortcut['group']> = ['General', 'Navigation', 'Hosts', 'Terminal']

/** Grouped list of every registered shortcut; shared by the ⌘/ sheet and Settings. */
export function ShortcutList() {
  return (
    <div className="grid gap-5">
      {GROUPS.map((group) => (
        <section key={group} aria-labelledby={`shortcuts-${group}`}>
          <h3 id={`shortcuts-${group}`} className="mb-2 text-[12px] font-medium text-fg-faint">
            {group}
          </h3>
          <dl className="divide-y divide-border-subtle rounded-lg border border-border bg-surface">
            {SHORTCUTS.filter((item) => item.group === group).map((item) => (
              <div key={item.id} className="flex h-10 items-center justify-between gap-4 px-3.5">
                <dt className="text-[13px] text-fg">{item.label}</dt>
                <dd className="m-0">
                  <Kbd id={item.id} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <p className="text-[12px] text-fg-faint">
        ⌃Tab / ⌃⇧Tab also switch sessions. Inside the terminal, Ctrl shortcuts go to the remote
        shell on Windows and Linux; click outside the terminal first.
      </p>
    </div>
  )
}
