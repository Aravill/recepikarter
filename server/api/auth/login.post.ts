export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const username = typeof body?.username === 'string' ? body.username.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  const expectedUsername = process.env.AUTH_USERNAME
  const expectedHash = process.env.AUTH_PASSWORD_HASH

  if (!expectedUsername || !expectedHash) {
    throw createError({ statusCode: 500, statusMessage: 'Auth not configured: set AUTH_USERNAME / AUTH_PASSWORD_HASH' })
  }

  const invalidCredentials = () =>
    createError({ statusCode: 401, statusMessage: 'Neplatné uživatelské jméno nebo heslo' })

  if (!username || !password || username !== expectedUsername) {
    throw invalidCredentials()
  }

  const valid = await verifyPassword(expectedHash, password)
  if (!valid) {
    throw invalidCredentials()
  }

  await setUserSession(event, { user: { username: expectedUsername } })
  return { ok: true }
})
