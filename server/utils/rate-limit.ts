import type { H3Event } from 'h3'

// In-memory fixed-window counter of failed attempts per key. One process,
// one household — no need for Redis; a restart forgetting the counts is
// fine.
export interface FailureLimiter {
  // Milliseconds until the key may try again, or 0 if it isn't blocked.
  retryAfterMs(key: string): number
  recordFailure(key: string): void
  reset(key: string): void
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

  return {
    retryAfterMs(key) {
      const w = live(key)
      return w && w.count >= maxFailures ? w.startedAt + windowMs - now() : 0
    },
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
  }
}

// The app runs behind a reverse proxy (see docker-compose.yml), so the
// socket peer is always the proxy. Caddy overwrites X-Forwarded-For with the
// real client address; the last entry is the one the nearest proxy added
// either way. Only trustworthy because the app port isn't reachable except
// through the proxy.
export function clientIp(event: H3Event): string {
  const forwarded = getRequestHeader(event, 'x-forwarded-for')?.split(',').pop()?.trim()
  return forwarded || event.node.req.socket.remoteAddress || 'unknown'
}
