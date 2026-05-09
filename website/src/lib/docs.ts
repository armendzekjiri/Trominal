/**
 * The docs surface is a curated reading order over markdown files that already
 * live in the repo (under /docs and at the repo root). To add a new doc, drop
 * a markdown file in the repo and add an entry below — that's it.
 */
export interface DocEntry {
  slug: string
  title: string
  /** Path relative to repo root. */
  source: string
  description: string
  category: 'Getting Started' | 'Operate' | 'Build' | 'Reference'
}

export const DOCS: DocEntry[] = [
  {
    slug: 'self-hosting',
    title: 'Self-hosting',
    source: 'docs/SELF_HOSTING.md',
    description:
      'Run a Trominal instance with Docker Compose. Backend, Reverb, queue, Postgres, Redis, and Caddy.',
    category: 'Getting Started',
  },
  {
    slug: 'admin-guide',
    title: 'Admin guide',
    source: 'docs/ADMIN_GUIDE.md',
    description: 'Operating the Filament admin panel — users, roles, registration mode, audit log.',
    category: 'Operate',
  },
  {
    slug: 'architecture',
    title: 'Architecture',
    source: 'docs/ARCHITECTURE.md',
    description: 'System diagram, data flows, transport modes, and where every component lives.',
    category: 'Reference',
  },
  {
    slug: 'security',
    title: 'Security',
    source: 'docs/SECURITY.md',
    description: 'Operational security playbook — TLS, rate limiting, 2FA, secrets handling.',
    category: 'Operate',
  },
  {
    slug: 'release-process',
    title: 'Release process',
    source: 'docs/RELEASE.md',
    description: 'How tagged releases are cut, signed, and shipped to GitHub Releases.',
    category: 'Build',
  },
  {
    slug: 'contributing',
    title: 'Contributing',
    source: 'CONTRIBUTING.md',
    description: 'Branch naming, conventional commits, testing bars, and review expectations.',
    category: 'Build',
  },
]

export function getDoc(slug: string): DocEntry | undefined {
  return DOCS.find((d) => d.slug === slug)
}

export function getDocNeighbors(slug: string): {
  prev: DocEntry | undefined
  next: DocEntry | undefined
} {
  const idx = DOCS.findIndex((d) => d.slug === slug)
  return {
    prev: idx > 0 ? DOCS[idx - 1] : undefined,
    next: idx < DOCS.length - 1 ? DOCS[idx + 1] : undefined,
  }
}
