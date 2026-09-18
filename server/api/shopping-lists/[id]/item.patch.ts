// A small targeted update keyed by item `key`, not a full-list overwrite —
// two people ticking different items on a shared list around the same time
// shouldn't stomp each other. Owner or, on a shared list, any household
// user may toggle.
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

  const body = await readBody(event)
  const { key, checked } = parseShoppingListItemPatch(body)
  // A key with no matching item is a silent no-op (returns the list
  // unchanged) rather than a 404 — existence of the *list* was already
  // checked above, and setShoppingListItemChecked only returns undefined
  // when the list itself is gone.
  return setShoppingListItemChecked(id, key, checked)!
})
