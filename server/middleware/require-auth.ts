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

  const { user } = await requireActiveSession(event)

  // Admin routes also call requireAdminSession themselves, so they don't
  // depend on this prefix match alone.
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
