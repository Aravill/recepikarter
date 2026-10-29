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
