export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const existing = getRecipe(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Recipe not found' })
  }
  if (existing.photoFile) {
    setRecipePhoto(id, null)
    await removePhotoFiles(existing.photoFile)
  }
  setResponseStatus(event, 204)
  return null
})
