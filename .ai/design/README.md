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
- Keep dark-first warm charcoal, green accent, and JetBrains Mono for terminal/code.
- If implementation must diverge, update the reference files first and explain why in the change summary.
- Do not implement marketing pages when the requested work is the app experience.
