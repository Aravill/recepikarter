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
