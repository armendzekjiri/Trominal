import { describe, expect, it } from 'vitest'
import { joinPath, normalizePath, parentPath } from './paths'

describe('joinPath', () => {
  it('joins a simple relative name onto an absolute base', () => {
    expect(joinPath('/home', 'ubuntu')).toBe('/home/ubuntu')
  })

  it('treats / as the absolute root', () => {
    expect(joinPath('/', 'home')).toBe('/home')
    expect(joinPath('', 'home')).toBe('/home')
  })

  it('navigates up with the dot-dot sentinel', () => {
    expect(joinPath('/home/ubuntu', '..')).toBe('/home')
    expect(joinPath('/', '..')).toBe('/')
  })

  it('ignores empty and dot names', () => {
    expect(joinPath('/srv/app', '.')).toBe('/srv/app')
    expect(joinPath('/srv/app', '')).toBe('/srv/app')
  })

  it('strips leading slashes from the joined name (the OpenSSH absolute-path bug)', () => {
    // Before we cd-and-ls in the Rust side, sftp returned absolute names from
    // `ls /home`, which would have produced `/home//home/ubuntu` here. The
    // hardened helper still defends against any server that misbehaves.
    expect(joinPath('/home', '/home/ubuntu')).toBe('/home/ubuntu')
    expect(joinPath('/', '///etc/passwd')).toBe('/etc/passwd')
  })

  it('does not double-slash when the base ends with /', () => {
    expect(joinPath('/home/', 'ubuntu')).toBe('/home/ubuntu')
  })
})

describe('parentPath', () => {
  it('walks one level up', () => {
    expect(parentPath('/home/ubuntu')).toBe('/home')
    expect(parentPath('/home')).toBe('/')
  })

  it('clamps at root', () => {
    expect(parentPath('/')).toBe('/')
    expect(parentPath('')).toBe('/')
  })

  it('ignores trailing slashes', () => {
    expect(parentPath('/home/ubuntu/')).toBe('/home')
    expect(parentPath('/home//')).toBe('/')
  })
})

describe('normalizePath', () => {
  it('collapses runs of slashes', () => {
    expect(normalizePath('/home//ubuntu///workspace')).toBe('/home/ubuntu/workspace')
  })

  it('strips a single trailing slash but preserves root', () => {
    expect(normalizePath('/home/ubuntu/')).toBe('/home/ubuntu')
    expect(normalizePath('/')).toBe('/')
  })

  it('passes empty input through unchanged', () => {
    expect(normalizePath('')).toBe('')
  })
})
