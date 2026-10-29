import type { H3Event } from 'h3'

// In-memory fixed-window counter of failed attempts per key. One process,
// one household — no need for Redis; a restart forgetting the counts is
// fine.
export interface FailureLimiter {
  // Milliseconds until the key may try again, or 0 if it isn't blocked.
  retryAfterMs(key: string): number
  recordFailure(key: string): void
  reset(key: string): void
  // Every key currently over the limit — for the admin's lockout view.
  blocked(): { key: string; retryAfterMs: number }[]
}

interface Window {
  count: number
  startedAt: number
}

export function createFailureLimiter(opts: {
  maxFailures: number
  windowMs: number
  // Bounds memory if someone sprays random usernames from many IPs.
  maxKeys?: number
  now?: () => number
}): FailureLimiter {
  const { maxFailures, windowMs, maxKeys = 10_000, now = Date.now } = opts
  const windows = new Map<string, Window>()

  function live(key: string): Window | undefined {
    const w = windows.get(key)
    if (w && now() - w.startedAt >= windowMs) {
      windows.delete(key)
      return undefined
    }
    return w
  }

  function prune() {
    for (const key of windows.keys()) live(key)
    // Still full of live windows: drop the oldest (Map keeps insertion order).
    for (const key of windows.keys()) {
      if (windows.size < maxKeys) break
      windows.delete(key)
    }
  }

  function retryAfterMs(key: string): number {
    const w = live(key)
    return w && w.count >= maxFailures ? w.startedAt + windowMs - now() : 0
  }

  return {
    retryAfterMs,
    recordFailure(key) {
      const w = live(key)
      if (w) {
        w.count++
        return
      }
      if (windows.size >= maxKeys) prune()
      windows.set(key, { count: 1, startedAt: now() })
    },
    reset(key) {
      windows.delete(key)
    },
    blocked() {
      const out: { key: string; retryAfterMs: number }[] = []
      // Copied first: live() deletes expired windows while we iterate.
      for (const key of [...windows.keys()]) {
        const ms = retryAfterMs(key)
        if (ms > 0) out.push({ key, retryAfterMs: ms })
      }
      return out
    },
  }
}

const LOGIN_WINDOW_MS = 15 * 60 * 1000
// Per client+username: what slows down guessing one account's password.
// Keyed on the IP too so a stranger can't lock the real user out.
export const loginAccountLimiter = createFailureLimiter({ maxFailures: 5, windowMs: LOGIN_WINDOW_MS })
// Per client across all usernames: stops one IP cycling through names.
export const loginClientLimiter = createFailureLimiter({ maxFailures: 20, windowMs: LOGIN_WINDOW_MS })
// The change-password current-password check is a guessing oracle for
// whoever holds the session (e.g. a stolen cookie), so it's throttled too.
export const currentPasswordLimiter = createFailureLimiter({ maxFailures: 5, windowMs: LOGIN_WINDOW_MS })

const ACCOUNT_KEY_SEPARATOR = '|'

export function loginAccountKey(ip: string, username: string): string {
  return `${ip}${ACCOUNT_KEY_SEPARATOR}${username.toLowerCase()}`
}

function lockedAccountKeys(username: string): { ip: string; key: string; retryAfterMs: number }[] {
  const suffix = loginAccountKey('', username)
  return loginAccountLimiter
    .blocked()
    .filter((b) => b.key.endsWith(suffix))
    .map((b) => ({ ...b, ip: b.key.slice(0, -suffix.length) }))
}

// When the user can next log in from the device that's locked out longest,
// or null if no device is. The admin user list shows this.
export function loginLockedUntil(username: string, now = Date.now()): string | null {
  const longest = Math.max(0, ...lockedAccountKeys(username).map((b) => b.retryAfterMs))
  return longest > 0 ? new Date(now + longest).toISOString() : null
}

// The admin's "Odemknout": forgets this user's failed attempts from every
// IP, those IPs' client-wide counters (one of which may be what's actually
// blocking them), and their change-password attempts.
export function resetLoginLimits(username: string): void {
  for (const { ip, key } of lockedAccountKeys(username)) {
    loginAccountLimiter.reset(key)
    loginClientLimiter.reset(ip)
  }
  currentPasswordLimiter.reset(username)
}

// From the internet the app is only reached through the Caddy proxy, so the
// socket peer is the proxy. Caddy overwrites X-Forwarded-For with the real
// client address; the last entry is the one the nearest proxy added either
// way. A client that can reach the app port directly (e.g. from the LAN,
// since docker-compose.yml publishes it on all interfaces) can forge this
// header — only the per-IP limit is affected, not the per-username one.
export function clientIp(event: H3Event): string {
  const forwarded = getRequestHeader(event, 'x-forwarded-for')?.split(',').pop()?.trim()
  return forwarded || event.node.req.socket.remoteAddress || 'unknown'
}
