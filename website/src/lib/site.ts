export const SITE = {
  name: 'Trominal',
  domain: 'trominal.app',
  url: 'https://trominal.app',
  tagline: 'The SSH client your terminal deserves.',
  description:
    'Trominal is an open-source, self-hosted SSH client for teams. Sync hosts, snippets, and identities across desktop and mobile — your data, your server, end-to-end encrypted.',
  github: {
    owner: 'armendzekjiri',
    repo: 'Trominal',
    url: 'https://github.com/armendzekjiri/Trominal',
    releasesUrl: 'https://github.com/armendzekjiri/Trominal/releases',
    issuesUrl: 'https://github.com/armendzekjiri/Trominal/issues',
    discussionsUrl: 'https://github.com/armendzekjiri/Trominal/discussions',
  },
  demo: {
    backendUrl: 'https://backend.trominal.app',
  },
  contactEmail: 'hello@trominal.app',
  license: 'AGPL-3.0',
} as const

export const NAV_ITEMS = [
  { href: '/features', label: 'Features' },
  { href: '/screenshots', label: 'Screenshots' },
  { href: '/docs', label: 'Docs' },
  { href: '/demo', label: 'Demo' },
  { href: '/changelog', label: 'Changelog' },
  { href: '/contribute', label: 'Contribute' },
] as const

export type NavKey =
  | 'home'
  | 'features'
  | 'screenshots'
  | 'docs'
  | 'demo'
  | 'changelog'
  | 'contribute'
  | 'install'
  | 'roadmap'
  | 'security'
  | 'brand'
  | 'contact'
  | 'privacy'
  | 'terms'
  | 'license'
