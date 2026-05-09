import type { APIRoute } from 'astro'
import { fetchGithubStats, FALLBACK_STATS, type GithubStats } from '@/lib/github'

export const prerender = false

const KV_KEY = 'github-stats:v1'
/** Stale-while-revalidate window: serve up to 10 min, refresh in background after. */
const TTL_SECONDS = 600
/** Hard cap; after this we always refetch even if KV says fresh. */
const HARD_TTL_SECONDS = 3600

interface CachedPayload {
  fetchedAt: number
  stats: GithubStats
}

function jsonResponse(stats: GithubStats, source: 'fresh' | 'cache' | 'fallback'): Response {
  return new Response(JSON.stringify(stats), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Browser cache for ~5 min, edge cache (CDN) up to 10 min.
      'Cache-Control': 'public, max-age=300, s-maxage=600',
      'X-Stats-Source': source,
    },
  })
}

export const GET: APIRoute = async ({ locals }) => {
  const env = (locals as { runtime?: { env?: { TROMINAL_STATS?: KVNamespace; GITHUB_TOKEN?: string } } })
    .runtime?.env
  const kv = env?.TROMINAL_STATS
  const token = env?.GITHUB_TOKEN

  // 1. Try the cache.
  if (kv) {
    try {
      const cached = await kv.get<CachedPayload>(KV_KEY, 'json')
      if (cached) {
        const ageSeconds = (Date.now() - cached.fetchedAt) / 1000
        if (ageSeconds < TTL_SECONDS) {
          return jsonResponse(cached.stats, 'cache')
        }
        if (ageSeconds < HARD_TTL_SECONDS) {
          // Stale but acceptable — serve cached, kick off background refresh.
          // (Cloudflare Workers ctx.waitUntil isn't reachable from Astro
          // without breaking the typed APIRoute, so we settle for blocking
          // refresh; it's still bounded by the GitHub fetch timeout.)
          try {
            const fresh = await fetchGithubStats({ token, timeoutMs: 4000 })
            const payload: CachedPayload = { fetchedAt: Date.now(), stats: fresh }
            await kv.put(KV_KEY, JSON.stringify(payload), { expirationTtl: HARD_TTL_SECONDS * 2 })
            return jsonResponse(fresh, 'fresh')
          } catch {
            return jsonResponse(cached.stats, 'cache')
          }
        }
      }
    } catch {
      // KV failed — fall through to live fetch.
    }
  }

  // 2. Cache miss / cold start — fetch live and seed the cache.
  try {
    const fresh = await fetchGithubStats({ token, timeoutMs: 6000 })
    if (kv) {
      const payload: CachedPayload = { fetchedAt: Date.now(), stats: fresh }
      try {
        await kv.put(KV_KEY, JSON.stringify(payload), { expirationTtl: HARD_TTL_SECONDS * 2 })
      } catch {
        /* cache write failed; non-fatal */
      }
    }
    return jsonResponse(fresh, 'fresh')
  } catch {
    return jsonResponse(FALLBACK_STATS, 'fallback')
  }
}
