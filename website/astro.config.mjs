import { defineConfig } from 'astro/config'
import cloudflare from '@astrojs/cloudflare'
import mdx from '@astrojs/mdx'
import tailwindcss from 'tailwindcss'

export default defineConfig({
  site: 'https://trominal.app',
  // Static by default; `src/pages/api/stats.json.ts` opts out with
  // `prerender = false` and runs in the Worker.
  output: 'static',
  // Astro 7 defaults to JSX whitespace rules; keep the pre-7 HTML compression
  // so inline spacing in the existing markup renders unchanged.
  compressHTML: true,
  // No sessions are used; without this the adapter enables a KV-backed
  // session driver and Wrangler auto-provisions an unused SESSION namespace.
  session: false,
  adapter: cloudflare({
    imageService: 'passthrough',
    // Docs, changelog, license, etc. read repo markdown via `node:fs` at
    // build time, so prerender in Node instead of workerd.
    prerenderEnvironment: 'node',
  }),
  // Cloudflare Workers don't ship `sharp`, and we don't need image
  // optimization for a marketing site of this size. Serve originals.
  image: {
    service: { entrypoint: 'astro/assets/services/noop' },
  },
  integrations: [
    mdx(),
    // Note: @astrojs/sitemap is incompatible with on-demand routes on the
    // Cloudflare adapter (it errors during build:done). Using a hand-rolled
    // sitemap at src/pages/sitemap.xml.ts instead.
  ],
  vite: {
    // Tailwind 3 via PostCSS (replaces the deprecated @astrojs/tailwind
    // integration, which does not support Astro 6+). `global.css` keeps its
    // own `@tailwind` directives, matching the old `applyBaseStyles: false`.
    css: {
      postcss: {
        plugins: [tailwindcss()],
      },
    },
  },
})
