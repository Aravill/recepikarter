import { describe, expect, it } from 'vitest'
import { createFailureLimiter } from '../../../server/utils/rate-limit'

function setup(opts: { maxFailures?: number; windowMs?: number; maxKeys?: number } = {}) {
  let t = 1_000_000
  const limiter = createFailureLimiter({ maxFailures: 3, windowMs: 60_000, ...opts, now: () => t })
  return { limiter, advance: (ms: number) => (t += ms) }
}

describe('createFailureLimiter', () => {
  it('blocks a key once it reaches maxFailures within the window', () => {
    const { limiter, advance } = setup()
    limiter.recordFailure('a')
    limiter.recordFailure('a')
    expect(limiter.retryAfterMs('a')).toBe(0)
    advance(10_000)
    limiter.recordFailure('a')
    expect(limiter.retryAfterMs('a')).toBe(50_000)
  })

  it('unblocks once the window has passed', () => {
    const { limiter, advance } = setup()
    for (let i = 0; i < 3; i++) limiter.recordFailure('a')
    advance(60_000)
    expect(limiter.retryAfterMs('a')).toBe(0)
    limiter.recordFailure('a')
    expect(limiter.retryAfterMs('a')).toBe(0)
  })

  it('tracks keys independently and reset clears one', () => {
    const { limiter } = setup()
    for (let i = 0; i < 3; i++) {
      limiter.recordFailure('a')
      limiter.recordFailure('b')
    }
    limiter.reset('a')
    expect(limiter.retryAfterMs('a')).toBe(0)
    expect(limiter.retryAfterMs('b')).toBeGreaterThan(0)
  })

  it('evicts the oldest keys instead of growing past maxKeys', () => {
    const { limiter } = setup({ maxFailures: 1, maxKeys: 2 })
    limiter.recordFailure('a')
    limiter.recordFailure('b')
    limiter.recordFailure('c')
    expect(limiter.retryAfterMs('a')).toBe(0)
    expect(limiter.retryAfterMs('b')).toBeGreaterThan(0)
    expect(limiter.retryAfterMs('c')).toBeGreaterThan(0)
  })
})
