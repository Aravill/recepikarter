// Unticks every item — the owner or, on a shared list, any household user
// may do this (same access as toggling an individual checkbox; see
// item.patch.ts), unlike rename/delete/share-toggle which stay owner-only.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const id = Number(getRouterParam(event, 'id'))
  const existing = getShoppingList(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Shopping list not found' })
  }
  if (existing.ownerUsername !== user.username && !existing.shared) {
    throw createError({ statusCode: 403, statusMessage: 'K tomuto seznamu nemáte přístup' })
  }

  return resetShoppingListItems(id)!
})
