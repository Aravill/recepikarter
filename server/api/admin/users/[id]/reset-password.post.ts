import { generateTempPassword } from '#shared/utils/password-policy'

// For a user who forgot their password: replaces it with a freshly
// generated temporary one, returned once for the admin to relay (same as
// POST /api/admin/users — there's no email/SMS delivery). The account goes
// back to must-change-password, and setUserPassword's session_version bump
// logs the user out on every device. Any failed-login lockout is lifted too,
// or a locked-out user couldn't use the new password.
export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const id = Number(getRouterParam(event, 'id'))
  const existing = getUser(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  const tempPassword = generateTempPassword(existing.username)
  setUserPassword(id, await hashPassword(tempPassword), true)
  resetLoginLimits(existing.username)

  return { user: getUser(id)!, tempPassword }
})
