export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const username = typeof body?.username === 'string' ? body.username.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  const ip = clientIp(event)
  const accountKey = loginAccountKey(ip, username)

  // Checked before verifyPassword so a blocked client doesn't get to spend
  // scrypt CPU either.
  const retryAfterMs = Math.max(loginAccountLimiter.retryAfterMs(accountKey), loginClientLimiter.retryAfterMs(ip))
  if (retryAfterMs > 0) {
    if (username) recordRefusedLogin(ip, username)
    const minutes = Math.ceil(retryAfterMs / 60_000)
    setResponseHeader(event, 'Retry-After', Math.ceil(retryAfterMs / 1000))
    throw createError({
      statusCode: 429,
      statusMessage: `Příliš mnoho neúspěšných pokusů. Zkuste to znovu za ${minutes} min.`,
    })
  }

  const invalidCredentials = () => {
    loginAccountLimiter.recordFailure(accountKey)
    loginClientLimiter.recordFailure(ip)
    return createError({ statusCode: 401, statusMessage: 'Neplatné uživatelské jméno nebo heslo' })
  }

  if (!username || !password) {
    throw invalidCredentials()
  }

  const expectedUsername = process.env.AUTH_USERNAME
  if (expectedUsername && username === expectedUsername) {
    // AUTH_PASSWORD_HASH is stored base64-encoded (see
    // scripts/hash-password.mjs) so the raw PHC-format hash's `$`
    // characters never hit a .env parser.
    const expectedHash = process.env.AUTH_PASSWORD_HASH
      ? Buffer.from(process.env.AUTH_PASSWORD_HASH, 'base64').toString('utf8')
      : undefined
    if (!expectedHash) {
      throw createError({ statusCode: 500, statusMessage: 'Auth not configured: set AUTH_USERNAME / AUTH_PASSWORD_HASH' })
    }

    const valid = await verifyPassword(expectedHash, password)
    if (!valid) throw invalidCredentials()

    loginAccountLimiter.reset(accountKey)
    recordSuccessfulLogin(ip, username)
    await replaceUserSession(event, {
      user: { username: expectedUsername, role: 'admin', mustChangePassword: false },
      secure: { credentialVersion: adminCredentialVersion() },
    })
    return { ok: true }
  }

  // Not the env admin — look up a DB-backed user. Blocked accounts get the
  // same generic error as a wrong password, so login doesn't leak whether a
  // username exists or is blocked.
  const row = findUserRowByUsername(username)
  if (!row || row.status === 'blocked') {
    throw invalidCredentials()
  }

  const valid = await verifyPassword(row.password_hash, password)
  if (!valid) throw invalidCredentials()

  loginAccountLimiter.reset(accountKey)
  recordSuccessfulLogin(ip, username)
  await replaceUserSession(event, {
    user: { username: row.username, role: 'user', mustChangePassword: !!row.must_change_password },
    secure: { credentialVersion: String(row.session_version) },
  })
  return { ok: true }
})
