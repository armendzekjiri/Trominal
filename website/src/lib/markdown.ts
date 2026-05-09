import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { marked } from 'marked'

// During Astro builds, process.cwd() is the website package directory
// regardless of where the compiled chunk ends up. The repo root is one level up.
const repoRoot = resolve(process.cwd(), '..')

marked.setOptions({
  gfm: true,
  breaks: false,
})

export interface RenderedMarkdown {
  html: string
  raw: string
  headings: { depth: number; text: string; slug: string }[]
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

/**
 * Read a markdown file from anywhere in the repo (path is relative to repo root)
 * and render it to HTML with `id` attributes added to every heading so anchor
 * links and the docs TOC work.
 */
export function renderRepoMarkdown(repoRelativePath: string): RenderedMarkdown {
  const fullPath = resolve(repoRoot, repoRelativePath)
  const raw = readFileSync(fullPath, 'utf-8')

  const headings: { depth: number; text: string; slug: string }[] = []
  const seen = new Map<string, number>()

  const renderer = new marked.Renderer()
  const originalHeading = renderer.heading.bind(renderer)
  renderer.heading = (heading) => {
    const text = heading.tokens
      .map((t) => ('raw' in t ? (t.raw as string) : ''))
      .join('')
    let slug = slugify(text)
    if (seen.has(slug)) {
      const n = (seen.get(slug) ?? 0) + 1
      seen.set(slug, n)
      slug = `${slug}-${n}`
    } else {
      seen.set(slug, 0)
    }
    headings.push({ depth: heading.depth, text, slug })
    const inner = originalHeading(heading)
    return inner.replace(`<h${heading.depth}`, `<h${heading.depth} id="${slug}"`)
  }

  const html = marked.parse(raw, { renderer, async: false }) as string
  return { html, raw, headings }
}
