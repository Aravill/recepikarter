export type UserStatus = 'active' | 'blocked'

export interface AppUser {
  id: number
  username: string
  status: UserStatus
  // True until the user changes the temporary password an admin set for
  // them — see server/api/auth/change-password.post.ts.
  mustChangePassword: boolean
  createdAt: string
  updatedAt: string
}

// GET /api/admin/users — the account plus its current login lockout, which
// lives in memory (see server/utils/rate-limit.ts), not in the users table.
export interface AdminUser extends AppUser {
  // ISO time the user can next log in from their locked-out device, or null
  // if they aren't locked out by failed login attempts.
  loginLockedUntil: string | null
}

// Why the server rejected a session — sent as the 401's `data.sessionEnded`
// and in the SESSION_ENDED_COOKIE (see requireActiveSession in
// server/utils/auth.ts) so the login page can tell the user.
export type SessionEndReason = 'blocked' | 'credentials-changed' | 'expired'

export const SESSION_END_MESSAGES: Record<SessionEndReason, string> = {
  blocked: 'Váš účet byl zablokován správcem.',
  'credentials-changed': 'Heslo k účtu bylo změněno. Přihlaste se znovu.',
  expired: 'Přihlášení vypršelo. Přihlaste se znovu.',
}

// Set alongside logging a session out, read once by the login page.
export const SESSION_ENDED_COOKIE = 'session-ended'
