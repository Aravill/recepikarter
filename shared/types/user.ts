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
