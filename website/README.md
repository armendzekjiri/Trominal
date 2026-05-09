# Trominal — Marketing site & docs

`trominal.app` — the landing page, install guide, public demo info, and full documentation for Trominal.

This is an Astro 5 + MDX project deployed to Cloudflare Pages with a tiny Worker (`/api/stats.json`) that fetches GitHub stars and the latest release, cached in KV for ~10 minutes.

It lives in the same monorepo as the rest of Trominal but ships independently.

---

## Quick start (local dev)

```bash
# From the repo root — first time only:
pnpm install

# Run the website on http://localhost:4321
pnpm --filter @trominal/website dev
```

If you hit GitHub rate limits during local builds, drop a personal access token in `website/.dev.vars`:

```
GITHUB_TOKEN=ghp_...
```

`.dev.vars` is gitignored.

---

## Deploying to Cloudflare Pages — step by step

You only have to do this once. After that, every push to `main` that touches `website/**` re-deploys automatically.

### 1. Create a Cloudflare account

If you don't already have one, sign up at [cloudflare.com](https://cloudflare.com). The Free plan is enough for the entire site.

### 2. Add `trominal.app` to Cloudflare

1. Cloudflare dashboard → **Add a Site** → enter `trominal.app`.
2. Pick the **Free** plan.
3. Cloudflare scans your existing DNS records. Confirm them.
4. Cloudflare gives you two nameservers — go to your domain registrar and **set the nameservers on `trominal.app`** to those values.
5. Wait for activation (usually a few minutes, sometimes a few hours). You can keep going while it propagates.

### 3. Create a KV namespace for the stats cache

The site's `/api/stats.json` endpoint caches GitHub data in Cloudflare KV.

```bash
# From inside the website/ directory:
pnpm dlx wrangler login                       # opens a browser
pnpm dlx wrangler kv namespace create TROMINAL_STATS
pnpm dlx wrangler kv namespace create TROMINAL_STATS --preview
```

Each command prints an `id`. Paste both into `website/wrangler.toml`, replacing the `REPLACE_WITH_KV_ID` placeholders. Commit the change.

### 4. Create the Pages project

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** tab → **Connect to Git**.
2. Authorize Cloudflare to read your GitHub account, then pick the `Trominal` repo.
3. **Project name:** `trominal-website` (or whatever you like — this becomes the `*.pages.dev` preview URL).
4. **Production branch:** `main`.
5. **Framework preset:** select **Astro**. (If it's not listed, pick "None".)
6. **Build settings:**
   - **Build command:** `pnpm install --frozen-lockfile && pnpm --filter @trominal/website build`
   - **Build output directory:** `website/dist`
   - **Root directory:** *(leave blank — keep it at the repo root)*
7. **Environment variables (Production):**
   - `GITHUB_REPO` = `armendzekjiri/Trominal`
   - `GITHUB_TOKEN` = a GitHub personal access token with **only public repo read access** (optional — without it the site still works, you just hit the lower anonymous rate limit during builds)
8. Click **Save and Deploy**. Wait for the first build. It will take 2–4 minutes.

### 5. Bind the KV namespace to the project

1. Inside the Pages project: **Settings** → **Functions** → **KV namespace bindings** → **Add binding**.
2. **Variable name:** `TROMINAL_STATS`
3. **KV namespace:** select the one you created in step 3.
4. Click **Save**. The next deploy will pick it up.

### 6. Enable analytics

The site is set up to use **Cloudflare Real User Measurements (RUM)** in auto-inject mode, which gives you privacy-friendly Core Web Vitals + page-view analytics without any cookies.

1. Cloudflare dashboard → pick the `trominal.app` zone → **Speed** → **Optimization** → **Real User Measurements**.
2. Choose **"Enable"** (the JS snippet will be automatically injected) — or **"Enable, excluding visitor data in the EU"** if you'd rather skip RUM for EU visitors.
3. That's it. Cloudflare's edge injects the beacon on every response — `Base.astro` does not include a manual snippet.

If you ever switch RUM to **"Enable with JS Snippet installation"** (manual mode), Cloudflare will give you a `<script>` tag with a token. Paste it into `<head>` in `src/layouts/Base.astro` where the analytics comment block lives.

### 7. Connect the custom domain

1. Inside the Pages project: **Custom domains** → **Set up a custom domain**.
2. Enter `trominal.app` and confirm. Cloudflare wires up DNS automatically.
3. Repeat for `www.trominal.app` if you want both — most projects redirect `www` → apex.
4. Verify HTTPS is green. (Cloudflare provisions a cert automatically.)

### 8. Done

Push to `main` → Cloudflare builds → live in ~2 minutes. Pull request branches get a preview URL.

---

## Updating

- **Edit a marketing page:** modify `src/pages/<page>.astro` and push.
- **Add a screenshot:** drop the file into `src/assets/screenshots/`, push.
- **Add a doc:** drop a markdown file in `/docs/` (repo root), then add an entry in `src/lib/docs.ts`.
- **Update demo URL or contact email:** edit `src/lib/site.ts`. Don't search-and-replace.
- **Change colors or fonts:** edit `src/styles/global.css` AND `tailwind.config.mjs`.

See `.ai/skills/website.md` for full guidance.

---

## What lives where

| Section / page          | File                                | Source                              |
| ----------------------- | ----------------------------------- | ----------------------------------- |
| Home                    | `src/pages/index.astro`             | Hand-written, with Hero/WhyGrid/etc |
| Features                | `src/pages/features.astro`          | Hand-written                        |
| Screenshots gallery     | `src/pages/screenshots.astro`       | Globs `src/assets/screenshots/`     |
| Install                 | `src/pages/install.astro`           | Hand-written, links to releases     |
| Demo                    | `src/pages/demo.astro`              | Hand-written; uses `SITE.demo`      |
| Contribute              | `src/pages/contribute.astro`        | Hand-written                        |
| Contact                 | `src/pages/contact.astro`           | Hand-written; uses `SITE.contactEmail` |
| Changelog               | `src/pages/changelog.astro`         | `/CHANGELOG.md`                     |
| Roadmap                 | `src/pages/roadmap.astro`           | Mirrors `PROJECT_BRIEF.md` §11      |
| Security                | `src/pages/security.astro`          | `/SECURITY.md`                      |
| Brand                   | `src/pages/brand.astro`             | Hand-written                        |
| Privacy                 | `src/pages/privacy.astro`           | Hand-written, real policy           |
| Terms                   | `src/pages/terms.astro`             | Hand-written, real terms            |
| License                 | `src/pages/license.astro`           | `/LICENSE`                          |
| Docs hub                | `src/pages/docs/index.astro`        | `DOCS` manifest                     |
| `/docs/<slug>`          | `src/pages/docs/[slug].astro`       | Maps via `DOCS` to repo markdown    |
| Stats API               | `src/pages/api/stats.json.ts`       | GitHub API → KV                     |

---

## Troubleshooting

**Build fails with "Cannot find module 'node:fs'"** — make sure `astro.config.mjs` has `node:*` in `vite.ssr.external`. The build pipeline only runs `node:fs` calls at build time (in `prerender = true` pages); the Cloudflare Worker for `/api/stats.json` does not touch the filesystem.

**Stats API returns the same numbers for hours** — KV cache is up to ~10 min for fresh, ~1 hour as the hard cap. Check the `X-Stats-Source` response header: `cache` means served from KV, `fresh` means a refetch happened, `fallback` means GitHub was unreachable. To force a refresh, delete the `github-stats:v1` key from the KV namespace.

**Build hits GitHub rate limit during install** — set `GITHUB_TOKEN` in the Pages env vars (step 4.7). Anonymous GitHub API gets 60 requests/hour per IP.
