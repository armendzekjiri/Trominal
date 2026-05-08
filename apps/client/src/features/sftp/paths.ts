/**
 * Path helpers shared by the local + remote SFTP panes.
 *
 * `joinPath` is defensive: it strips any leading slashes from the joined name
 * so a misbehaving SFTP server that returns absolute names from `ls /path`
 * (OpenSSH used to do this before we switched to `cd`+`ls`) cannot produce
 * `/home//home/ubuntu` style double-slashes.
 */

export function joinPath(base: string, name: string): string {
  if (name === '..') return parentPath(base)
  if (name === '.' || name === '') return base
  if (name.startsWith('/')) {
    // The joined name is absolute — adopt it wholesale. This guards against
    // legacy/quirky SFTP servers that return absolute names from `ls /path`,
    // which would otherwise have stitched `/home` + `/home/ubuntu` into
    // `/home//home/ubuntu` (the original bug).
    return normalizePath(name)
  }
  if (base === '' || base === '/') return `/${name}`
  if (base.endsWith('/')) return `${base}${name}`
  return `${base}/${name}`
}

export function parentPath(path: string): string {
  if (path === '' || path === '/') return '/'
  const stripped = path.replace(/\/+$/, '')
  const idx = stripped.lastIndexOf('/')
  if (idx <= 0) return '/'
  return stripped.slice(0, idx) || '/'
}

/** Collapse runs of slashes; preserve a leading slash and tolerate empty input. */
export function normalizePath(path: string): string {
  if (path === '') return ''
  const collapsed = path.replace(/\/{2,}/g, '/')
  if (collapsed === '/') return '/'
  // Strip a single trailing slash unless it's the root.
  return collapsed.endsWith('/') ? collapsed.slice(0, -1) : collapsed
}
