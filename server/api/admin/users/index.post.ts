// Creates a user with a temporary password the admin sets (or, if omitted,
// one generated here) — returned once in the response so the admin can
// relay it, since this app has no email/SMS delivery. The account is
// created with mustChangePassword already set (see createUser in
// server/utils/db.ts), so that password only works to log in once.
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const username = parseUsername(body?.username)

  if (username === process.env.AUTH_USERNAME) {
    throw createError({ statusCode: 409, statusMessage: 'Toto uživatelské jméno je vyhrazené pro správce' })
  }
  if (findUserRowByUsername(username)) {
    throw createError({ statusCode: 409, statusMessage: 'Uživatel s tímto jménem už existuje' })
  }

  const providedPassword = typeof body?.tempPassword === 'string' ? body.tempPassword.trim() : ''
  if (providedPassword && providedPassword.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Dočasné heslo musí mít alespoň 8 znaků' })
  }
  const tempPassword = providedPassword || generateTempPassword()

  const passwordHash = await hashPassword(tempPassword)
  const user = createUser(username, passwordHash)

  setResponseStatus(event, 201)
  return { user, tempPassword }
})
