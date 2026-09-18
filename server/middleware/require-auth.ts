export default defineEventHandler(async (event) => {
  const path = event.path
  if (
    !path.startsWith('/api/recipes') &&
    !path.startsWith('/api/admin') &&
    !path.startsWith('/api/shopping-lists') &&
    !path.startsWith('/api/meal-plans')
  ) {
    return
  }

  const { user } = await requireUserSession(event)

  if (user.role === 'user') {
    // Re-checked on every request (not just at login) so blocking a user
    // takes effect immediately, not just on their next login.
    const row = findUserRowByUsername(user.username)
    if (!row || row.status === 'blocked') {
      await clearUserSession(event)
      throw createError({ statusCode: 401, statusMessage: 'Účet byl zablokován' })
    }
  }

  if (path.startsWith('/api/admin') && user.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Vyžadována administrátorská role' })
  }

  if (
    (path.startsWith('/api/recipes') || path.startsWith('/api/shopping-lists') || path.startsWith('/api/meal-plans')) &&
    user.mustChangePassword
  ) {
    throw createError({ statusCode: 403, statusMessage: 'Nejprve si musíte změnit heslo' })
  }
})
