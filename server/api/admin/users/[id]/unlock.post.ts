// Lifts a lockout caused by too many failed logins (see resetLoginLimits in
// server/utils/rate-limit.ts) instead of making the user wait it out.
// Unrelated to block/unblock, which is the admin's own account switch.
export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const id = Number(getRouterParam(event, 'id'))
  const user = getUser(id)
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }
  resetLoginLimits(user.username)
  setResponseStatus(event, 204)
  return null
})
