import { describe, expect, it } from 'vitest'
import {
  createFailureLimiter,
  loginAccountKey,
  loginAccountLimiter,
  loginClientLimiter,
  loginLockouts,
  recordRefusedLogin,
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
  function failLogins(ip: string, username: string, times: number) {
    for (let i = 0; i < times; i++) {
      loginAccountLimiter.recordFailure(loginAccountKey(ip, username))
      loginClientLimiter.recordFailure(ip)
    }
  }

  it('reports a locked-out user, matching the username case-insensitively', () => {
    failLogins('10.0.0.1', 'Lock-A', 5)
    const lockouts = loginLockouts()
    expect(lockouts.get('lock-a')).toBeDefined()
    // A username that's a suffix of the locked one isn't affected.
    expect(lockouts.get('ck-a')).toBeUndefined()
  })

  it('reports a user refused only because their IP hit the client-wide limit', () => {
    failLogins('10.0.0.5', 'someone-else', 4)
    for (let i = 0; i < 16; i++) loginClientLimiter.recordFailure('10.0.0.5')
    expect(loginLockouts().get('lock-c')).toBeUndefined()

    recordRefusedLogin('10.0.0.5', 'lock-c')
    expect(loginLockouts().get('lock-c')).toBeDefined()

    resetLoginLimits('lock-c')
    expect(loginLockouts().get('lock-c')).toBeUndefined()
    expect(loginClientLimiter.retryAfterMs('10.0.0.5')).toBe(0)
  })

  it("doesn't let a username containing the separator pose as another user", () => {
    failLogins('10.0.0.6', 'x|lock-d', 5)
    const lockouts = loginLockouts()
    expect(lockouts.get('lock-d')).toBeUndefined()
    expect(lockouts.get('x|lock-d')).toBeDefined()
  })

  it('resetLoginLimits clears the user from every IP, and those IPs’ counters', () => {
    failLogins('10.0.0.2', 'lock-b', 5)
    failLogins('10.0.0.3', 'lock-b', 5)
    for (let i = 0; i < 15; i++) loginClientLimiter.recordFailure('10.0.0.2')
    failLogins('10.0.0.4', 'other-user', 5)

    resetLoginLimits('lock-b')

    expect(loginLockouts().get('lock-b')).toBeUndefined()
    expect(loginClientLimiter.retryAfterMs('10.0.0.2')).toBe(0)
    expect(loginLockouts().get('other-user')).toBeDefined()
  })
})
