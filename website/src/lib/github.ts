import { SITE } from './site'

export interface GithubStats {
  stars: number
  contributors: number | null
  latestVersion: string | null
  latestReleaseName: string | null
  latestReleaseDate: string | null
  latestReleaseUrl: string | null
}

/**
 * Floor values used when the GitHub API is unreachable. They represent
 * "unknown but believable" placeholders so the UI never shows a loading
 * shimmer for fields that should always have something.
 */
export const FALLBACK_STATS: GithubStats = {
  stars: 0,
  contributors: null,
  latestVersion: 'v0.1.0-dev',
  latestReleaseName: null,
  latestReleaseDate: null,
  latestReleaseUrl: SITE.github.releasesUrl,
}

interface FetchOptions {
  /** Optional GitHub token to raise the rate limit at build time. */
  token?: string
  /** Bound an outer fetch to this many ms (Cloudflare Worker friendly). */
  timeoutMs?: number
}

async function gh<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'trominal-website',
  }
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000)

  try {
    const res = await fetch(`https://api.github.com${path}`, {
      headers,
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new Error(`GitHub ${path} → ${res.status}`)
    }
    return (await res.json()) as T
  } finally {
    clearTimeout(t)
  }
}

interface RepoResponse {
  stargazers_count: number
}

interface ReleaseResponse {
  tag_name: string
  name: string | null
  published_at: string
  html_url: string
  draft: boolean
  prerelease: boolean
}

interface ContributorResponse {
  login: string
}

export async function fetchGithubStats(opts: FetchOptions = {}): Promise<GithubStats> {
  const repo = `${SITE.github.owner}/${SITE.github.repo}`
  const token = opts.token ?? (typeof process !== 'undefined' ? process.env?.GITHUB_TOKEN : undefined)

  const [repoData, releases, contributors] = await Promise.allSettled([
    gh<RepoResponse>(`/repos/${repo}`, { ...opts, token }),
    gh<ReleaseResponse[]>(`/repos/${repo}/releases?per_page=10`, { ...opts, token }),
    gh<ContributorResponse[]>(`/repos/${repo}/contributors?per_page=100`, { ...opts, token }),
  ])

  const out: GithubStats = { ...FALLBACK_STATS }

  if (repoData.status === 'fulfilled') {
    out.stars = repoData.value.stargazers_count
  }

  if (releases.status === 'fulfilled') {
    const latest = releases.value.find((r) => !r.draft && !r.prerelease) ?? releases.value[0]
    if (latest) {
      out.latestVersion = latest.tag_name
      out.latestReleaseName = latest.name
      out.latestReleaseDate = latest.published_at
      out.latestReleaseUrl = latest.html_url
    }
  }

  if (contributors.status === 'fulfilled') {
    out.contributors = contributors.value.length
  }

  return out
}
