# Skill — Marketing site & docs (`website/`)

Load this skill when working in `/website/`. The marketing site is a separate workspace package with its own deploy lifecycle. It is **not** the Tauri client and **not** the Laravel backend.

---

## What this is

A static-first marketing/docs site at `https://trominal.app` that explains Trominal, points to the public demo backend, and serves the canonical user-facing documentation. It is a **third surface** alongside the client app and the Filament admin panel.

## Stack (locked)

| Decision        | Value                                                                |
| --------------- | -------------------------------------------------------------------- |
| Framework       | **Astro 5** (`output: 'hybrid'`)                                     |
| Adapter         | **`@astrojs/cloudflare`** (Cloudflare Pages + Workers)               |
| Content authoring | **MDX** for in-website pages, **markdown sourced from `/docs/*.md`** for docs section |
| Styling         | **Tailwind 3** + a hand-written `global.css` with CSS custom properties |
| Fonts           | **`@fontsource/inter` + `@fontsource/jetbrains-mono`** (self-hosted, no Google Fonts) |
| Analytics       | **Cloudflare Real User Measurements (RUM)** auto-injected at the zone level (no cookies, no fingerprinting). `Base.astro` deliberately does not include a manual beacon — Cloudflare's edge injects it. |
| Live data       | `/api/stats.json` Worker route, **KV-cached 10 min** (`TROMINAL_STATS` namespace) |
| Domain          | `trominal.app`                                                        |
| License banner  | **AGPL-3.0** — never "MIT" anywhere                                  |

## File layout

```
website/
├── astro.config.mjs           # hybrid mode, Cloudflare adapter, MDX, sitemap, Tailwind
├── tailwind.config.mjs        # design tokens mirroring global.css custom props
├── wrangler.toml              # Cloudflare config, KV binding for TROMINAL_STATS
├── design-reference/          # original HTML/CSS/JS reference — DO NOT MODIFY
├── public/                    # favicons, robots.txt, og-default.png, icon-1024.png
└── src/
    ├── styles/global.css      # full CSS token set + base styles + .prose styling
    ├── lib/
    │   ├── site.ts            # SITE constants — URLs, contact email, GitHub repo
    │   ├── github.ts          # fetchGithubStats() + FALLBACK_STATS
    │   ├── docs.ts            # DOCS manifest mapping slug → repo markdown source
    │   ├── markdown.ts        # renderRepoMarkdown() — reads files from repo root
    │   └── format.ts          # formatStarCount, formatDate
    ├── components/
    │   ├── chrome/            # Logo, Icon, Header, Footer, StarCount, LatestVersion
    │   ├── home/              # Hero, WhyGrid, AppShowcase, InstallTease, BuiltInTheOpen, CTA
    │   └── docs/              # docs-only widgets (none yet — Docs.astro is the layout)
    ├── layouts/
    │   ├── Base.astro         # <head>, fonts, OG/Twitter, CF Analytics beacon
    │   ├── Page.astro         # marketing page chrome
    │   └── Docs.astro         # docs page chrome (TOC, sidebar nav, prev/next)
    ├── pages/
    │   ├── index.astro        # home
    │   ├── features.astro
    │   ├── screenshots.astro  # auto-globs src/assets/screenshots/*.{png,jpg,...}
    │   ├── install.astro
    │   ├── demo.astro
    │   ├── contribute.astro
    │   ├── contact.astro
    │   ├── changelog.astro    # renders /CHANGELOG.md
    │   ├── roadmap.astro      # mirrors PROJECT_BRIEF.md §11
    │   ├── security.astro     # renders /SECURITY.md
    │   ├── brand.astro        # tokens + logo download
    │   ├── privacy.astro      # real privacy policy (must stay accurate)
    │   ├── terms.astro        # real terms of use
    │   ├── license.astro      # renders /LICENSE
    │   ├── docs/index.astro   # docs hub
    │   ├── docs/[slug].astro  # dynamic, sources via DOCS manifest
    │   └── api/stats.json.ts  # Worker route, KV-cached
    └── assets/
        ├── brand/icon-1024.png
        └── screenshots/       # drop PNG/JPG/WebP here, screenshots page picks them up
```

## How to do common things

### Add a screenshot to the gallery

1. Drop the file in `website/src/assets/screenshots/` — `kebab-case-title.png`. JPG and WebP also work.
2. That's it. The filename becomes the caption; the page renders automatically. If the folder is empty, the page shows a "no screenshots yet" placeholder with a maintainer note.

### Add a documentation page

1. Add (or move) the markdown file under `/docs/` at the repo root (or use an existing root-level file like `CONTRIBUTING.md`).
2. Add an entry to `DOCS` in `src/lib/docs.ts` — `slug`, `title`, `source` (path relative to repo root), `description`, `category`.
3. The new page is reachable at `/docs/<slug>` with auto-generated TOC, sidebar nav, prev/next, and "Edit on GitHub" link.

### Add a marketing page

1. Create `src/pages/foo.astro` and use `<Page title="Foo" active="foo">` from `@/layouts/Page.astro`.
2. Add the new key to the `NavKey` union in `src/lib/site.ts`.
3. If it should appear in the top nav, add to `NAV_ITEMS`. If it should appear in the footer only, add a footer link in `src/components/chrome/Footer.astro`.

### Update the GitHub repo URL

`src/lib/site.ts` is the single source of truth. Change it once; star count, releases URL, every download link, every "View source" follow.

### Update the demo backend URL

`SITE.demo.backendUrl` in `src/lib/site.ts`. Privacy and terms pages reference it; bump the `lastUpdated` constant in those pages when the URL changes.

### Tweak design tokens

Both `src/styles/global.css` (the canonical CSS-variable set) and `tailwind.config.mjs` mirror the same palette. **Edit both.** The CSS variables drive the page; the Tailwind theme exposes them as utility classes for any new components.

### Refresh fake test data / clean up unfinished sections

There is no fake data. Stars/contributors/release date all come from the live GitHub API via `fetchGithubStats()`. The `Hero` "release line" and `BuiltInTheOpen` block degrade gracefully when there's no release yet. **Never reintroduce fake testimonials or "Used by..." logos.**

## Hard rules

- **No fake testimonials, no fake company logos, no fake star counts.** The "Built in the open" section uses live GitHub stats only.
- **License is AGPL-3.0 everywhere** — copy, footer, brand kit, terms. Never "MIT".
- **Privacy + terms are real.** When the demo backend changes behavior (retention, registration mode, etc.) update both pages and bump `lastUpdated`.
- **No analytics with cookies.** Cloudflare Web Analytics is the cap.
- **No new dependency without justification** — same monorepo rule. Don't pull in icon libraries (we have a hand-curated SVG set in `Icon.astro`); don't pull in markdown frameworks (we use `marked` already).
- **`design-reference/` is read-only.** It's the original visual source. Reference it; don't modify it.
- **Versioned data lives in code, not strings.** Anything that says "v1.4.2" must come from `fetchGithubStats()` or a build-time release lookup, never a hardcoded value in markup.
- **Server endpoint files (`src/pages/api/*`)** must export `prerender = false`. Static pages should keep the default (or set `prerender = true` explicitly when reading repo files at build time).

## Local dev

```bash
pnpm install                      # from repo root, picks up the website workspace
pnpm --filter @trominal/website dev
# → http://localhost:4321
```

`fetchGithubStats()` runs at build time against the public GitHub API; if you're rate-limited, set `GITHUB_TOKEN` in `website/.dev.vars` (gitignored).

## Deploy

See `website/README.md` for the full Cloudflare Pages setup walkthrough. Short version:

1. Connect the GitHub repo to Cloudflare Pages with build dir `website/`, build cmd `pnpm install --frozen-lockfile && pnpm --filter @trominal/website build`, output `website/dist`.
2. Bind the `TROMINAL_STATS` KV namespace to the Pages project.
3. Add `trominal.app` as the custom domain.
4. Set `GITHUB_REPO=armendzekjiri/Trominal` (already in `wrangler.toml`) and optionally `GITHUB_TOKEN` for higher rate limits.
5. Push to `main` → auto-deploy.

## Common pitfalls

- **`src/pages/api/stats.json.ts` cache header conflict** — the page sets `Cache-Control` for the browser, but Cloudflare Pages also applies its own static cache. Don't expect the response to be fresher than 5 minutes for any one client.
- **Reading repo markdown** — `renderRepoMarkdown()` resolves paths relative to the repo root, not the website package root. Use `docs/SELF_HOSTING.md`, not `../docs/SELF_HOSTING.md`.
- **OG images** — `og-default.png` is the 1024×1024 icon today. Per-page OG images are not generated yet; if you add them, use `astro-og-canvas` and update `Base.astro`.
- **`og-default.png` and `icon-1024.png`** are static copies of `apps/client/src-tauri/icons/source/icon.png`. If the app icon changes, sync both.
