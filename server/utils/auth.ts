import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'
import type { UserSession } from '#auth-utils'
import { SESSION_END_MESSAGES, SESSION_ENDED_COOKIE } from '#shared/types/user'
import type { SessionEndReason } from '#shared/types/user'
import { passwordPolicyMessage, passwordPolicyViolations } from '#shared/utils/password-policy'

// nuxt-auth-utils' cookie name (h3's useSession default; not overridden in
// nuxt.config.ts).
const SESSION_COOKIE_NAME = 'nuxt-session'

const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{2,32}$/

export function parseUsername(value: unknown): string {
  const username = typeof value === 'string' ? value.trim() : ''
  if (!USERNAME_PATTERN.test(username)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Uživatelské jméno musí mít 2–32 znaků: písmena, číslice, pomlčku nebo podtržítko',
    })
  }
  return username
}

export function assertPasswordPolicy(password: string, username: string): void {
  const violations = passwordPolicyViolations(password, username)
  if (violations.length) {
    throw createError({ statusCode: 400, statusMessage: passwordPolicyMessage(violations) })
  }
}

// The admin has no DB row to version, so its sessions are tied to the
// password hash in .env instead: changing AUTH_PASSWORD_HASH (and
// restarting) logs the admin out everywhere.
export function adminCredentialVersion(): string {
  return createHash('sha256')
    .update(process.env.AUTH_PASSWORD_HASH || '')
    .digest('hex')
    .slice(0, 16)
}

type ActiveSession = UserSession & Required<Pick<UserSession, 'user'>>

// Why a signed-in session is no longer acceptable, or undefined if it still
// is: the user isn't blocked and the password hasn't changed since the
// session was issued. requireUserSession alone only proves the cookie was
// sealed by us.
function staleSessionReason(session: ActiveSession): SessionEndReason | undefined {
  const { user } = session
  const version = session.secure?.credentialVersion
  if (user.role === 'admin') {
    return user.username !== process.env.AUTH_USERNAME || version !== adminCredentialVersion()
      ? 'credentials-changed'
      : undefined
  }
  // Re-checked on every request (not just at login) so blocking a user
  // takes effect immediately, not just on their next login.
  const row = findUserRowByUsername(user.username)
  if (!row || row.status === 'blocked') return 'blocked'
  if (version !== String(row.session_version)) return 'credentials-changed'
  return undefined
}

// Logs the session out and leaves the reason in a short-lived cookie the
// login page reads (app/pages/login.vue) to tell the user why. A cookie
// rather than only the 401 body because a revoked session is just as often
// noticed while server-rendering a page, where no client code sees the
// error.
async function endSession(event: H3Event, reason: SessionEndReason): Promise<void> {
  await clearUserSession(event)
  setCookie(event, SESSION_ENDED_COOKIE, reason, {
    path: '/',
    maxAge: 60,
    sameSite: 'lax',
    secure: useRuntimeConfig(event).session?.cookie?.secure,
  })
}

// Used by every authenticated API request (server/middleware/require-auth.ts)
// and the client's session fetch (server/plugins/session.ts). Every 401 it
// throws carries data.sessionEnded — the explicit signal app/utils/apiFetch.ts
// logs the open tab out on, as opposed to e.g. the login form's 401 for a
// wrong password.
export async function requireActiveSession(event: H3Event): Promise<ActiveSession> {
  const session = (await getUserSession(event)) as UserSession
  const reason = session.user ? staleSessionReason(session as ActiveSession) : 'expired'
  if (reason) {
    // No user: never signed in, or the cookie expired. Only worth a notice
    // if the browser still sent a session cookie.
    if (session.user || getCookie(event, SESSION_COOKIE_NAME)) await endSession(event, reason)
    throw createError({
      statusCode: 401,
      statusMessage: SESSION_END_MESSAGES[reason],
      data: { sessionEnded: reason },
    })
  }
  return session as ActiveSession
}

// For full page loads: the same check, but instead of failing the request it
// just ends a stale session on the response the browser actually receives,
// so the page renders logged out and the login page can say why. (The
// session fetch during server rendering is an internal request whose
// Set-Cookie never reaches the browser.)
export async function endStaleSession(event: H3Event): Promise<void> {
  if (!getCookie(event, SESSION_COOKIE_NAME)) return
  const session = (await getUserSession(event)) as UserSession
  if (!session.user) return
  const reason = staleSessionReason(session as ActiveSession)
  if (reason) await endSession(event, reason)
}

export async function requireAdminSession(event: H3Event): Promise<ActiveSession> {
  const session = await requireActiveSession(event)
  if (session.user.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Vyžadována administrátorská role' })
  }
  return session
}
