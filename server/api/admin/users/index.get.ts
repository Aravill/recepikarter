import type { AdminUser } from '#shared/types/user'

export default defineEventHandler(async (event): Promise<AdminUser[]> => {
  await requireAdminSession(event)
  return listUsers().map((user) => ({ ...user, loginLockedUntil: loginLockedUntil(user.username) }))
})
