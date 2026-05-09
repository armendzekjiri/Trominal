import type { APIRoute } from 'astro'
import { DOCS } from '@/lib/docs'
import { SITE } from '@/lib/site'

export const prerender = true

const STATIC_PATHS = [
  '/',
  '/features',
  '/screenshots',
  '/install',
  '/demo',
  '/contribute',
  '/contact',
  '/changelog',
  '/roadmap',
  '/security',
  '/brand',
  '/privacy',
  '/terms',
  '/license',
  '/docs',
] as const

export const GET: APIRoute = () => {
  const docPaths = DOCS.map((d) => `/docs/${d.slug}`)
  const allPaths = [...STATIC_PATHS, ...docPaths]

  const urls = allPaths
    .map(
      (path) => `  <url>
    <loc>${SITE.url}${path}</loc>
    <changefreq>weekly</changefreq>
  </url>`,
    )
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
