// Rename and/or toggle the shared flag — owner-only (see the auth rule
// in the feature's design note: any authenticated user may toggle
// checkboxes on a list they can see, but only the owner may rename, delete
// or change its shared flag).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const id = Number(getRouterParam(event, 'id'))
  const existing = getShoppingList(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Shopping list not found' })
  }
  if (existing.ownerUsername !== user.username) {
    throw createError({ statusCode: 403, statusMessage: 'Pouze vlastník může seznam upravit' })
  }

  const body = await readBody(event)
  const patch = parseShoppingListPatch(body)
  return updateShoppingListMeta(id, patch)!
})
