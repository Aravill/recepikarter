import type { AdminUser } from '#shared/types/user'

export default defineEventHandler(async (event): Promise<AdminUser[]> => {
  await requireAdminSession(event)
  const lockouts = loginLockouts()
  return listUsers().map((user) => ({ ...user, loginLockedUntil: lockouts.get(user.username.toLowerCase()) ?? null }))
})
