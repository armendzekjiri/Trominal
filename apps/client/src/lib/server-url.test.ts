import { describe, expect, it } from 'vitest'
import { isDevelopmentHost, parseServerUrl, requireSecureWebSocketUrl } from './server-url'

describe('parseServerUrl', () => {
  it('accepts https URLs and trims trailing slashes', () => {
    expect(parseServerUrl('  https://trominal.example.com/  ')).toEqual({
      ok: true,
      url: 'https://trominal.example.com',
    })
    expect(parseServerUrl('https://example.com/trominal/')).toEqual({
      ok: true,
      url: 'https://example.com/trominal',
    })
  })

  it.each([
    'http://localhost',
    'http://localhost:8000',
    'http://127.0.0.1:8031',
    'http://127.1.2.3',
    'http://[::1]:8000',
    'http://trominal.localhost',
    'http://backend.test',
  ])('allows plain http for local development host %s', (input) => {
    expect(parseServerUrl(input).ok).toBe(true)
  })

  it.each([
    'http://trominal.example.com',
    'http://192.168.1.10',
    'http://10.0.0.5:8000',
    'http://localhost.example.com',
    'http://example.test.com',
  ])('rejects plain http for non-local host %s', (input) => {
    const result = parseServerUrl(input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/https/i)
  })

  it.each(['ftp://example.com', 'javascript:alert(1)', 'file:///etc/passwd', 'ws://localhost'])(
    'rejects non-http(s) scheme %s',
    (input) => {
      expect(parseServerUrl(input).ok).toBe(false)
    },
  )

  it('rejects empty input, garbage and embedded credentials', () => {
    expect(parseServerUrl('').ok).toBe(false)
    expect(parseServerUrl('not a url').ok).toBe(false)
    expect(parseServerUrl('https://user:pass@example.com').ok).toBe(false)
  })

  it('rejects query strings and fragments', () => {
    expect(parseServerUrl('https://example.com/?x=1').ok).toBe(false)
    expect(parseServerUrl('https://example.com/#frag').ok).toBe(false)
  })
})

describe('isDevelopmentHost', () => {
  it('only matches loopback, *.localhost and *.test', () => {
    expect(isDevelopmentHost('localhost')).toBe(true)
    expect(isDevelopmentHost('api.localhost')).toBe(true)
    expect(isDevelopmentHost('trominal.test')).toBe(true)
    expect(isDevelopmentHost('127.0.0.1')).toBe(true)
    expect(isDevelopmentHost('[::1]')).toBe(true)
    expect(isDevelopmentHost('example.com')).toBe(false)
    expect(isDevelopmentHost('127.0.0.1.nip.io')).toBe(false)
  })
})

describe('requireSecureWebSocketUrl', () => {
  it('accepts wss everywhere', () => {
    expect(() => requireSecureWebSocketUrl('wss://example.com/ws/ssh?token=x')).not.toThrow()
  })

  it('accepts ws only for local development hosts', () => {
    expect(() => requireSecureWebSocketUrl('ws://localhost:8080/ws/ssh')).not.toThrow()
    expect(() => requireSecureWebSocketUrl('ws://example.com/ws/ssh')).toThrow(/wss/i)
  })

  it('rejects other schemes', () => {
    expect(() => requireSecureWebSocketUrl('https://example.com/ws/ssh')).toThrow()
  })
})
