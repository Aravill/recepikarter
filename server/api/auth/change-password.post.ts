// Used both for the forced first-login password change (see
// app/pages/change-password.vue) and any later voluntary change — same
// endpoint either way, gated only by requiring the current password.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  if (user.role === 'admin') {
    throw createError({ statusCode: 400, statusMessage: 'Heslo správce se nastavuje přes .env, ne v aplikaci' })
  }

  const body = await readBody(event)
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : ''
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''

  if (newPassword.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Nové heslo musí mít alespoň 8 znaků' })
  }

  const row = findUserRowByUsername(user.username)
  if (!row || row.status === 'blocked') {
    throw createError({ statusCode: 401, statusMessage: 'Neautorizováno' })
  }

  const valid = await verifyPassword(row.password_hash, currentPassword)
  if (!valid) {
    throw createError({ statusCode: 401, statusMessage: 'Současné heslo není správné' })
  }

  const newHash = await hashPassword(newPassword)
  setUserPassword(row.id, newHash, false)

  await setUserSession(event, { user: { username: row.username, role: 'user', mustChangePassword: false } })
  return { ok: true }
})
