// The current user's own saved lists plus every shared list regardless of
// owner — never someone else's private list. See listShoppingLists in
// server/utils/db.ts.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  return listShoppingLists(user.username)
})
