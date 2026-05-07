import { describe, expect, it } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('joins truthy class names', () => {
    expect(cn('a', 'b', false, undefined, null, 'c')).toBe('a b c')
  })

  it('resolves Tailwind conflicts by keeping the last directive', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('text-fg', 'text-fg-muted')).toBe('text-fg-muted')
  })
})
