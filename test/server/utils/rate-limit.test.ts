import { describe, expect, it } from 'vitest'
import {
  createFailureLimiter,
  loginAccountKey,
  loginAccountLimiter,
  loginClientLimiter,
  loginLockedUntil,
  resetLoginLimits,
} from '../../../server/utils/rate-limit'

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

describe('createFailureLimiter blocked()', () => {
  it('lists only keys over the limit, with time left', () => {
    const { limiter, advance } = setup()
    for (let i = 0; i < 3; i++) limiter.recordFailure('a')
    limiter.recordFailure('b')
    advance(20_000)
    expect(limiter.blocked()).toEqual([{ key: 'a', retryAfterMs: 40_000 }])
    advance(40_000)
    expect(limiter.blocked()).toEqual([])
  })
})

describe('login lockouts', () => {
  function lockOut(ip: string, username: string) {
    for (let i = 0; i < 5; i++) {
      loginAccountLimiter.recordFailure(loginAccountKey(ip, username))
      loginClientLimiter.recordFailure(ip)
    }
  }

  it('reports a locked-out user, matching the username case-insensitively', () => {
    lockOut('10.0.0.1', 'Lock-A')
    expect(loginLockedUntil('lock-a')).not.toBeNull()
    // A username that's a suffix of the locked one isn't affected.
    expect(loginLockedUntil('ck-a')).toBeNull()
  })

  it('resetLoginLimits clears the user from every IP, and those IPs’ counters', () => {
    lockOut('10.0.0.2', 'lock-b')
    lockOut('10.0.0.3', 'lock-b')
    for (let i = 0; i < 15; i++) loginClientLimiter.recordFailure('10.0.0.2')
    lockOut('10.0.0.4', 'other-user')

    resetLoginLimits('lock-b')

    expect(loginLockedUntil('lock-b')).toBeNull()
    expect(loginClientLimiter.retryAfterMs('10.0.0.2')).toBe(0)
    expect(loginLockedUntil('other-user')).not.toBeNull()
  })
})
