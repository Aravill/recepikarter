import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'
import type { UserSession } from '#auth-utils'
import { passwordPolicyMessage, passwordPolicyViolations } from '#shared/utils/password-policy'

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

// requireUserSession only proves the cookie was sealed by us. This also
// checks it still matches current state — the user isn't blocked and the
// password hasn't changed since it was issued — and logs the session out
// if not. Used by every authenticated API request (server/middleware/
// require-auth.ts) and the client's session fetch (server/plugins/session.ts).
export async function requireActiveSession(event: H3Event): Promise<ActiveSession> {
  const session = (await requireUserSession(event)) as ActiveSession
  const { user } = session
  const version = session.secure?.credentialVersion

  let reason: string | undefined
  if (user.role === 'admin') {
    if (user.username !== process.env.AUTH_USERNAME || version !== adminCredentialVersion()) {
      reason = 'Přihlášení vypršelo, přihlaste se znovu'
    }
  } else {
    // Re-checked on every request (not just at login) so blocking a user
    // takes effect immediately, not just on their next login.
    const row = findUserRowByUsername(user.username)
    if (!row || row.status === 'blocked') {
      reason = 'Účet byl zablokován'
    } else if (version !== String(row.session_version)) {
      reason = 'Přihlášení vypršelo, přihlaste se znovu'
    }
  }

  if (reason) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: reason })
  }
  return session
}

export async function requireAdminSession(event: H3Event): Promise<ActiveSession> {
  const session = await requireActiveSession(event)
  if (session.user.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Vyžadována administrátorská role' })
  }
  return session
}
