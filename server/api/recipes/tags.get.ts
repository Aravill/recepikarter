// Static path, so Nitro matches it ahead of the /api/recipes/:id route.
export default defineEventHandler(() => {
  return listTags()
})
