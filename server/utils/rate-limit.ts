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

// Attempts the limiters turned away, per client+username. The client-wide
// limit never sees the username, so without this a user locked out by it
// (e.g. a shared home IP that racked up failures across names) would be
// invisible to the admin. Any live entry counts, hence maxFailures: 1.
const refusedLogins = createFailureLimiter({ maxFailures: 1, windowMs: LOGIN_WINDOW_MS })

const ACCOUNT_KEY_SEPARATOR = '|'

// The username is encoded so one containing the separator (login accepts
// any string) can't pose as a different IP + username pair. IPs never
// contain it.
export function loginAccountKey(ip: string, username: string): string {
  return `${ip}${ACCOUNT_KEY_SEPARATOR}${encodeURIComponent(username.toLowerCase())}`
}

function parseAccountKey(key: string): { ip: string; username: string } {
  const at = key.indexOf(ACCOUNT_KEY_SEPARATOR)
  return { ip: key.slice(0, at), username: decodeURIComponent(key.slice(at + 1)) }
}

export function recordRefusedLogin(ip: string, username: string): void {
  refusedLogins.recordFailure(loginAccountKey(ip, username))
}

interface Lockout {
  ip: string
  username: string
  retryAfterMs: number
}

// Every client+username currently unable to log in, by either limit.
function currentLockouts(): Lockout[] {
  const keys = new Set([...loginAccountLimiter.blocked(), ...refusedLogins.blocked()].map((b) => b.key))
  const out: Lockout[] = []
  for (const key of keys) {
    const { ip, username } = parseAccountKey(key)
    const retryAfterMs = Math.max(loginAccountLimiter.retryAfterMs(key), loginClientLimiter.retryAfterMs(ip))
    if (retryAfterMs > 0) out.push({ ip, username, retryAfterMs })
  }
  return out
}

// Lowercased username -> ISO time the user can next log in from the device
// that's locked out longest. Built once per call so the admin user list
// doesn't rescan the limiters for every row.
export function loginLockouts(now = Date.now()): Map<string, string> {
  const longest = new Map<string, number>()
  for (const { username, retryAfterMs } of currentLockouts()) {
    longest.set(username, Math.max(longest.get(username) ?? 0, retryAfterMs))
  }
  return new Map([...longest].map(([username, ms]) => [username, new Date(now + ms).toISOString()]))
}

// IPs each user has successfully logged in from since the server started —
// how "Odemknout" tells the user's own devices from an attacker's. Only
// real accounts ever log in, so the map is bounded by the user count; each
// set keeps the most recent few.
const MAX_KNOWN_IPS_PER_USER = 10
const knownLoginIps = new Map<string, Set<string>>()

export function recordSuccessfulLogin(ip: string, username: string): void {
  const lower = username.toLowerCase()
  const ips = knownLoginIps.get(lower) ?? new Set<string>()
  ips.delete(ip) // re-insert so the Set's order stays most-recent-last
  ips.add(ip)
  if (ips.size > MAX_KNOWN_IPS_PER_USER) ips.delete(ips.values().next().value!)
  knownLoginIps.set(lower, ips)
}

// The admin's "Odemknout": lifts this user's lockouts — per-account counters
// and the client-wide counters of the same IPs (one of which may be what's
// actually blocking them) — plus their change-password attempts. Only on
// IPs the user has logged in from before, so an attacker locked out on the
// same account doesn't get a fresh round of guesses with every unlock. If
// none of the locked IPs is known (a new device, or a restart cleared the
// list), there's nothing to tell them apart by, so all are lifted.
export function resetLoginLimits(username: string): void {
  const lower = username.toLowerCase()
  const locked = currentLockouts().filter((l) => l.username === lower)
  const known = knownLoginIps.get(lower)
  const ownLocks = locked.filter((l) => known?.has(l.ip))
  for (const { ip } of ownLocks.length ? ownLocks : locked) {
    const key = loginAccountKey(ip, username)
    loginAccountLimiter.reset(key)
    refusedLogins.reset(key)
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
