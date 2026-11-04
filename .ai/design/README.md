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

Rebuilt so far: **app shell** (top bar + collapsible sidebar), **Hosts**, **auth screens**, **Settings**, and the shared header/label/list styles used by Snippets, Identities, Tunnels, SFTP and Terminal. Those five keep their own layouts; only their chrome follows this spec.

### App shell

- **Top bar**, 44px, `bg-elev`, bottom border, full window width above the sidebar and content. It is the window's drag region. On macOS desktop the native title bar is hidden (`titleBarStyle: Overlay`) and the bar leaves 78px on the left for the traffic lights; Windows/Linux keep the native title bar. From the left:
  - Sidebar toggle (`⌘B` / `Ctrl+B`).
  - **Vault tab**: the current section's icon and name (Hosts, Snippets, …). Active whenever you're not on a terminal session; clicking it returns to the last section you used.
  - **Session tabs** (desktop): one per open terminal, status dot + name, close button on hover/active, middle-click closes. Tabs are 32px tall, `r-3`, max 200px, truncated. Active: `surface-2` fill, `fg` text, 2px `accent` underline. Inactive: `fg-muted`, hover `surface`.
  - **+** opens a menu: "Local shell" (`⌘T`) then every saved host.
  - Trailing: the search / command palette button ("Search", `⌘K`).
- **Left sidebar**, `bg-elev`, below the top bar. Two widths, remembered per device:
  - Expanded, 224px: team scope switcher, primary nav, then pinned to the bottom Settings, Lock vault, and an account row (initials avatar, email, role badge, "Open admin panel" for admins, "Sign out").
  - Collapsed, 60px icon rail: icons only (each with a tooltip and `aria-label`), no team switcher, account row shrinks to the avatar. Width animates over 200ms (off under `prefers-reduced-motion`).
- The Terminal page no longer has its own tab strip; it shows the active session's toolbar (command line, Connect / Reconnect / Disconnect, Ask AI) under the top bar.
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

### Host key verification (desktop)

Desktop SSH, SFTP, tunnels and key install never trust a server on their own. The approved keys are stored, encrypted, on the host record.

- **First connect** to a host with no approved key opens the **host key dialog** (`role="dialog"`, `aria-modal`, Tab trapped, Esc / backdrop = Cancel, focus returns to where it was). Header: shield icon tile (`accent-soft`/`accent`), title "Verify host key", `user@host:port` in mono `fg-faint`. Body: one line of explanation ("Compare these fingerprints with the ones your server administrator gave you…"), then one row per key the server offered: key type label (`ED25519`, `ECDSA`, `RSA`, 11px medium `fg-muted`) above the full `SHA256:` fingerprint in 12px mono `fg`, `break-all`, on `surface` with a 1px `border`, `r-3`. Footer: **Cancel** (outline, focused first) and **Trust and connect** (primary). Nothing connects until the user picks Trust.
- **Key changed** (the server presents none of the approved keys) is a hard stop: same dialog shell with a `danger-soft`/`danger` warning icon, title "Host key changed", a short warning that this can mean an attack, then "Approved" fingerprints and "Server now presents" fingerprints as two labelled lists. The only actions are **Close** and **Open host editor** (outline). There is no accept button here.
- **Host editor → "Host key" section** (below Tags, desktop only, saved hosts only): label 12px medium `fg-muted`; either "Not verified yet — you'll be asked to approve the fingerprint on first connect." (`fg-faint`) or the approved fingerprints (type + mono fingerprint rows as above). One outline button: **Verify host key** (none approved) or **Check host key** (approved). Checking a matching server shows a `role="status"` line "Server key matches the approved key."; a different key opens the dialog in **replace** mode: the changed-key layout plus a **Replace approved key** danger button, which is the only way to re-approve.
- Team hosts can't be edited yet, so an approval for them lasts for the app session only and the dialog says so in one `fg-faint` line.

### Auth screens

- Two columns at `lg` and up: a brand panel (`bg-elev`, accent glow top-left, one-line claim, three pillars: end-to-end encrypted, self-hosted, built for teams; licence line at the bottom) and the form column. Below `lg`: the form column alone, with the logo above it.
- Form column: max 380px (register 400px), server badge as a pill top-right, 22px title, field labels in sentence case.

### Page chrome (all sections)

- Every section starts with a 56px header: 15px semibold title, optional count pill, actions on the trailing side.
- Field labels: 12px medium `fg-muted`, sentence case. Column/section headers: 11px medium `fg-faint`. No uppercase-tracking labels.
- Selectable list rows: full 1px border, selected = `accent` border + `accent-soft` fill (no left stripe).
- Settings: left menu styled like the main sidebar, unfinished sections carry a "Soon" pill; the active section is in the URL (`/settings?tab=…`).
- Settings → AI: provider, endpoint, API key, then **Fetch models** lists what that endpoint offers (filterable list, arrow keys move the selection). No model is ever hardcoded or pre-filled; "Enter a model ID manually" covers gateways without a model list. Save and Test stay disabled until a model is picked.

### Team workspaces

- The workspace switcher offers **Create team** to users with `teams.create` and `teams.read.own`. A compact dialog asks for a team name, with Cancel and Create buttons and a short explanation that the team name is encrypted. Show validation or server errors in the dialog. On success, select the new team in the switcher. Team management and shared resource writes remain subject to the member's team role.
- For a selected team, a **Members** dialog lists its members and roles. Owners and admins with `teams.members.invite` can add an existing instance user by email and choose a permitted role; only owners can assign the owner role. Key wrapping happens locally, and a changed or locked workspace cancels the request before it is submitted.

### Keyboard

- All bindings live in `apps/client/src/lib/shortcuts.ts`; the palette, tooltips, the ⌘/ sheet and Settings → Shortcuts read from it. Add a binding there, never inline.
- ⌘K command palette (pages, settings sections, actions, "Connect to <host>"), ⌘/ shortcut sheet, ⌘, settings, ⌘⇧L lock, ⌘1–6 sections, ⌘B sidebar, ⌘F / ⌘N on Hosts, ⌘T new local shell, ⌘W close session tab, ⌘⇧[ / ⌘⇧] (or ⌃Tab / ⌃⇧Tab) previous/next session, ⌘⌥1–9 jump to session N; all work from any section. Windows/Linux: Ctrl+Shift+W closes and Alt+1–9 jumps, because Ctrl+W and Ctrl+T belong to the shell. On macOS the native Tab menu owns ⌘T and ⌘W, and Close Window moves to ⌘⇧W. Ctrl replaces ⌘ on Windows/Linux.
- Inside the terminal on Windows/Linux, Ctrl chords go to the shell, not the app.
- Overlays (palette, sheet) are `role="dialog"` + `aria-modal`, trap Tab, close on Esc and backdrop click, and return focus to where it was.
