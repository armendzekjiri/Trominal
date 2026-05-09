/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

type KVNamespace = import('@cloudflare/workers-types').KVNamespace

type Runtime = import('@astrojs/cloudflare').Runtime<{
  TROMINAL_STATS: KVNamespace
  GITHUB_REPO: string
  GITHUB_TOKEN?: string
}>

declare namespace App {
  interface Locals extends Runtime {}
}
