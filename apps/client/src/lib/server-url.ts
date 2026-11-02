/**
 * Transport policy for the Trominal server URL.
 *
 * Access tokens, refresh tokens and vault ciphertext travel over this
 * connection, so it must be HTTPS. Plain HTTP is allowed only for hosts that
 * cannot leave the machine or that are reserved for local development:
 * loopback addresses, `localhost` / `*.localhost` (RFC 6761) and `*.test`
 * (RFC 2606). Private-network IPs are deliberately NOT exempt: other devices
 * on that network can still read the traffic.
 */

export type ServerUrlResult = { ok: true; url: string } | { ok: false; message: string }

const HTTPS_REQUIRED =
  'Use an https:// URL. Plain http:// is only allowed for localhost, 127.0.0.1 and *.test development servers.'

/** `hostname` as returned by `URL#hostname` (IPv6 keeps its brackets). */
export function isDevelopmentHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host.endsWith('.test')) return true
  if (host === '[::1]') return true
  return /^127(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(host)
}

/** Validate and normalise a server URL typed by the user. */
export function parseServerUrl(input: string): ServerUrlResult {
  const trimmed = input.trim()
  if (trimmed === '') return { ok: false, message: 'Enter a server URL.' }

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return { ok: false, message: 'Enter a full URL, for example https://trominal.example.com.' }
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, message: HTTPS_REQUIRED }
  }
  if (url.protocol === 'http:' && !isDevelopmentHost(url.hostname)) {
    return { ok: false, message: HTTPS_REQUIRED }
  }
  if (url.username !== '' || url.password !== '') {
    return { ok: false, message: 'Remove the username and password from the URL.' }
  }
  if (url.search !== '' || url.hash !== '') {
    return { ok: false, message: 'Remove the query string or fragment from the URL.' }
  }

  return { ok: true, url: `${url.origin}${url.pathname}`.replace(/\/+$/, '') }
}

/**
 * Throw unless a server-issued WebSocket URL is `wss://` (or `ws://` to a local
 * development host). Guards web SSH against a misconfigured proxy that would
 * otherwise send terminal traffic and the session token in the clear.
 */
export function requireSecureWebSocketUrl(websocketUrl: string): void {
  let url: URL
  try {
    url = new URL(websocketUrl)
  } catch {
    throw new Error('The server returned an invalid terminal URL.')
  }
  if (url.protocol === 'wss:') return
  if (url.protocol === 'ws:' && isDevelopmentHost(url.hostname)) return
  throw new Error(
    'The server returned an insecure terminal URL. Web SSH needs wss:// — check the HTTPS and trusted-proxy settings of your server.',
  )
}
