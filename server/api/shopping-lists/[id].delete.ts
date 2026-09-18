export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const id = Number(getRouterParam(event, 'id'))
  const existing = getShoppingList(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Shopping list not found' })
  }
  if (existing.ownerUsername !== user.username) {
    throw createError({ statusCode: 403, statusMessage: 'Pouze vlastník může seznam smazat' })
  }

  deleteShoppingList(id)
  setResponseStatus(event, 204)
  return null
})
