# Trominal Design Reference

This folder is the visual source of truth for the client app. Read it before changing UI in `apps/client/`.

## Files

- [`tokens.css`](tokens.css) - canonical design tokens for color, radius, spacing, and typography.
- [`primitives.jsx`](primitives.jsx) - shared primitive components used by the mockups.
- [`design-canvas.jsx`](design-canvas.jsx) - overview canvas for the reference UI.
- [`screens-auth.jsx`](screens-auth.jsx) - first-launch, login, register, and auth flows.
- [`screens-hosts.jsx`](screens-hosts.jsx) - hosts, groups, credentials, and host details.
- [`screens-terminal.jsx`](screens-terminal.jsx) - terminal workspace and session UI.
- [`screens-tools.jsx`](screens-tools.jsx) - snippets, tunnels, SFTP, and related tools.
- [`screens-settings.jsx`](screens-settings.jsx) - account, vault, AI, appearance, and server settings.
- [`screens-system.jsx`](screens-system.jsx) - system states, empty states, and operational views.
- [`tweaks-panel.jsx`](tweaks-panel.jsx) - visual adjustment helpers.
- [`Trominal.html`](Trominal.html) - static preview/export artifact.

## Rules

- Match these references when implementing UI.
- Use `tokens.css` values through mapped Tailwind tokens instead of raw Tailwind colors.
- Dark-first **cool slate** neutrals with the **green accent** as the brand colour. **Inter** for UI text, **JetBrains Mono** for terminal, hostnames, ports, keys and code.
- Contrast is part of the token contract: `fg`, `fg-muted` and `fg-faint` stay at 4.5:1 or better on `bg`, `surface` and `surface-3`; form fields use `border-input` (3:1 or better). Re-check when changing a token.
- If implementation must diverge, update the reference files first and explain why in the change summary.
- Do not implement marketing pages when the requested work is the app experience.

## Direction (2026-11): Termius-style layout

Approved by the maintainer on 2026-11-02: keep Trominal's green accent, move to a Termius-style structure on cool slate surfaces. Where this section and an older mockup disagree, **this section wins**. The mockups are updated screen by screen as each area is rebuilt.

Rebuilt so far: **app shell**, **Hosts**, **auth screens**, **Settings**, and the shared header/label/list styles used by Snippets, Identities, Tunnels, SFTP and Terminal. Those five keep their own layouts; only their chrome follows this spec.

### App shell

- Left sidebar, 224px, `bg-elev`, full height. From the top: logo row, team scope switcher, primary nav, then pinned to the bottom: Settings, Lock vault, and an account row (initials avatar, email, role badge, menu with "Open admin panel" for admins and "Sign out").
- Nav rows: 34px tall, `r-3`, 16px lucide icon + label. Active: `accent-soft` background, `accent` icon, `fg` text, `aria-current="page"`. Hover: `surface-2`.
- Every icon-only control has an `aria-label`; every control has a visible `:focus-visible` ring (2px `accent-ring`, 2px offset).

### Hosts

- **Toolbar** (56px, bottom border): title "Hosts" with a count, then on the trailing side a search field (`⌘F` / `Ctrl+F` focuses it) and the primary **New host** button (`⌘N` / `Ctrl+N`).
- **Group chips** under the toolbar: "All" plus one chip per group (colour dot, name, count). A trailing "+ Group" chip turns into an inline input.
- **Host grid**: `repeat(auto-fill, minmax(260px, 1fr))`, 12px gap, 20px page padding. Each card: `surface`, `border`, `r-4`, 14px padding.
  - Left: 40px rounded (`r-3`) tile in the host colour at low opacity with a server icon in the full colour.
  - Name (`fg`, 13px medium), then `user@host:port` in mono (`fg-muted`, 11px), then tags as small mono chips and a key badge when an identity is attached.
  - Hover: `surface-2` + `border-strong`, and a **Connect** button appears on the trailing edge. Selected: `accent` border.
  - Click selects and opens the editor; double-click or `Enter` connects.
- **Editor panel**: slides in from the right (380px, `bg-elev`, left border) only while creating or editing a host; `Esc` closes it. It holds the existing host form (label, hostname, port, username, group, identity, colour swatches, tags) and Save / Delete / Connect.
- **Empty vault**: centred illustration-free empty state: icon tile, "No hosts yet", one-line explanation, **New host** button.
- Motion: 150-200ms transitions on hover, focus and panel open, disabled under `prefers-reduced-motion`.

### Auth screens

- Two columns at `lg` and up: a brand panel (`bg-elev`, accent glow top-left, one-line claim, three pillars: end-to-end encrypted, self-hosted, built for teams; licence line at the bottom) and the form column. Below `lg`: the form column alone, with the logo above it.
- Form column: max 380px (register 400px), server badge as a pill top-right, 22px title, field labels in sentence case.

### Page chrome (all sections)

- Every section starts with a 56px header: 15px semibold title, optional count pill, actions on the trailing side.
- Field labels: 12px medium `fg-muted`, sentence case. Column/section headers: 11px medium `fg-faint`. No uppercase-tracking labels.
- Selectable list rows: full 1px border, selected = `accent` border + `accent-soft` fill (no left stripe).
- Settings: left menu styled like the main sidebar, unfinished sections carry a "Soon" pill; the active section is in the URL (`/settings?tab=…`).

### Keyboard

- All bindings live in `apps/client/src/lib/shortcuts.ts`; the palette, tooltips, the ⌘/ sheet and Settings → Shortcuts read from it. Add a binding there, never inline.
- ⌘K command palette (pages, settings sections, actions, "Connect to <host>"), ⌘/ shortcut sheet, ⌘, settings, ⌘⇧L lock, ⌘1–6 sections, ⌘F / ⌘N on Hosts, ⌘T and ⌘⇧[ / ⌘⇧] in Terminal. Ctrl replaces ⌘ on Windows/Linux.
- Inside the terminal on Windows/Linux, Ctrl chords go to the shell, not the app.
- Overlays (palette, sheet) are `role="dialog"` + `aria-modal`, trap Tab, close on Esc and backdrop click, and return focus to where it was.
