// Used both for the forced first-login password change (see
// app/pages/change-password.vue) and any later voluntary change — same
// endpoint either way, gated only by requiring the current password.
// The current-password check is a guessing oracle for whoever holds the
// session (e.g. a stolen cookie), so it's throttled like login.
const currentPasswordLimiter = createFailureLimiter({ maxFailures: 5, windowMs: 15 * 60 * 1000 })

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role === 'admin') {
    throw createError({ statusCode: 400, statusMessage: 'Heslo správce se nastavuje přes .env, ne v aplikaci' })
  }

  const body = await readBody(event)
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : ''
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''

  assertPasswordPolicy(newPassword, user.username)

  const row = findUserRowByUsername(user.username)
  if (!row || row.status === 'blocked') {
    throw createError({ statusCode: 401, statusMessage: 'Neautorizováno' })
  }

  if (currentPasswordLimiter.retryAfterMs(row.username) > 0) {
    throw createError({ statusCode: 429, statusMessage: 'Příliš mnoho neúspěšných pokusů. Zkuste to znovu později.' })
  }
  const valid = await verifyPassword(row.password_hash, currentPassword)
  if (!valid) {
    currentPasswordLimiter.recordFailure(row.username)
    throw createError({ statusCode: 401, statusMessage: 'Současné heslo není správné' })
  }
  currentPasswordLimiter.reset(row.username)
  if (newPassword === currentPassword) {
    throw createError({ statusCode: 400, statusMessage: 'Nové heslo se musí lišit od současného' })
  }

  const newHash = await hashPassword(newPassword)
  setUserPassword(row.id, newHash, false)

  await setUserSession(event, { user: { username: row.username, role: 'user', mustChangePassword: false } })
  return { ok: true }
})
