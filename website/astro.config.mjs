import { defineConfig } from 'astro/config'
import cloudflare from '@astrojs/cloudflare'
import mdx from '@astrojs/mdx'
import tailwind from '@astrojs/tailwind'

export default defineConfig({
  site: 'https://trominal.app',
  output: 'hybrid',
  adapter: cloudflare({
    platformProxy: { enabled: true },
    imageService: 'passthrough',
  }),
  // Cloudflare Workers don't ship `sharp`, and we don't need image
  // optimization for a marketing site of this size. Serve originals.
  image: {
    service: { entrypoint: 'astro/assets/services/noop' },
  },
  integrations: [
    tailwind({ applyBaseStyles: false }),
    mdx(),
    // Note: @astrojs/sitemap is incompatible with hybrid + Cloudflare adapter
    // (it errors during build:done). Using a hand-rolled sitemap at
    // src/pages/sitemap.xml.ts instead.
  ],
  vite: {
    ssr: {
      external: ['node:fs', 'node:path', 'node:url'],
    },
  },
})
