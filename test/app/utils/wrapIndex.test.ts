import { describe, expect, it } from 'vitest'
import { wrapIndex } from '../../../app/utils/wrapIndex'

describe('wrapIndex', () => {
  it('wraps within range for the common case', () => {
    expect(wrapIndex(0, 3)).toBe(0)
    expect(wrapIndex(2, 3)).toBe(2)
    expect(wrapIndex(3, 3)).toBe(0)
    expect(wrapIndex(4, 3)).toBe(1)
  })

  it('wraps negative deltas', () => {
    expect(wrapIndex(-1, 3)).toBe(2)
    expect(wrapIndex(-3, 3)).toBe(0)
    expect(wrapIndex(-4, 3)).toBe(2)
  })

  it('always returns 0 for n = 1', () => {
    expect(wrapIndex(0, 1)).toBe(0)
    expect(wrapIndex(1, 1)).toBe(0)
    expect(wrapIndex(-1, 1)).toBe(0)
    expect(wrapIndex(5, 1)).toBe(0)
  })

  it('handles n = 2', () => {
    expect(wrapIndex(0, 2)).toBe(0)
    expect(wrapIndex(1, 2)).toBe(1)
    expect(wrapIndex(2, 2)).toBe(0)
    expect(wrapIndex(-1, 2)).toBe(1)
    expect(wrapIndex(-2, 2)).toBe(0)
  })

  it('returns 0 for n <= 0 rather than dividing by zero', () => {
    expect(wrapIndex(3, 0)).toBe(0)
    expect(wrapIndex(-3, 0)).toBe(0)
  })
})
