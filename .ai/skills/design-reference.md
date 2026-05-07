# Skill: Design Reference

> Load this before visual work in `apps/client/`.

## Source Of Truth

The UI reference lives in [`.ai/design/`](../design/). Start with [`.ai/design/README.md`](../design/README.md), then inspect the screen file for the feature you are building.

## Required Files To Check

| Work area                            | Reference files                                        |
| ------------------------------------ | ------------------------------------------------------ |
| Auth, onboarding, server URL setup   | `screens-auth.jsx`, `tokens.css`, `primitives.jsx`     |
| Hosts, groups, credentials           | `screens-hosts.jsx`, `tokens.css`, `primitives.jsx`    |
| Terminal workspace                   | `screens-terminal.jsx`, `tokens.css`, `primitives.jsx` |
| Snippets, tunnels, SFTP, tools       | `screens-tools.jsx`, `tokens.css`, `primitives.jsx`    |
| Settings, account, AI, appearance    | `screens-settings.jsx`, `tokens.css`, `primitives.jsx` |
| Empty, loading, error, system states | `screens-system.jsx`, `tokens.css`, `primitives.jsx`   |

## Visual Rules

- Keep the product UI dark-first, warm charcoal, and work-focused.
- Use mapped Tailwind design tokens from `tokens.css`; do not use raw color classes like `text-zinc-*` or `bg-neutral-*`.
- Use shadcn/ui primitives before creating custom components.
- Use lucide icons for icon buttons when an icon exists.
- Keep app screens dense, predictable, and optimized for repeated SSH workflows.
- Avoid marketing-style hero sections, decorative cards, gradient blobs, and one-note palettes.
- Do not put cards inside cards.
- Make fixed-format UI stable with explicit dimensions, grid tracks, aspect ratios, or min/max constraints.
- Ensure text fits inside controls on mobile and desktop.

## Implementation Rule

If the implemented UI intentionally differs from the reference, update the `.ai/design/` reference first, then implement the app change.
